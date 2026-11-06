"""Routes for the mobile app, which works offline and syncs later.

POST /api/mobile/login   same login as the web, but the token lasts 30 days. The web token
                         is short on purpose; a farmer who scans in the field and syncs days
                         later should not have to sign in again first. With the phone's
                         device_token it also connects the phone's farmer ID to the account.
POST /api/mobile/device  a phone with no account gets its own farmer ID and a device token.
POST /api/mobile/scans   upload one scan (form data, with the photo as the "image" file).
                         The web Diagnose page uses it too when a farmer saves a scan.
                         Safe to repeat: sending the same scan_uuid again updates the notes
                         and the farmer's feedback instead of making a duplicate.
GET  /api/mobile/scans   the farmer's own scans, for the Online view of the app's dashboard.
                         Only what the charts and map need; the label is the one to count
                         (officer's correction, then the farmer's, then the model's).

Scans are synced by a farmer account or by a phone's device token. Each farmer account has
one farmers row (farmers.user_id), and the scan is stored under that row's farmer_id; a phone
without an account uses its own row. The first sync fills in the farm details the row is
still missing. Deactivated farmers can neither sign in nor upload.
Errors are { "error": "message" }.
"""
import os
import uuid as uuidlib
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt, get_jwt_identity, jwt_required

from database import get_connection
from farmers import add_farmer, claim_phone_farmer
from mobile_scans import LABELS
from scans import UPLOAD_DIR
from security import verify_password
from web_auth import DEACTIVATED, is_deactivated, user_json

mobile_sync = Blueprint("mobile_sync", __name__)

TOKEN_LIFETIME = timedelta(days=30)
PHONE_TOKEN_LIFETIME = timedelta(days=3650)  # a phone without an account keeps its farmer ID
FEEDBACK = ("correct", "incorrect")
IMAGE_SOURCES = ("Camera", "Gallery", "Web")  # Web: a farmer saving from the web Diagnose page

# The photo is checked by its first bytes, not by the name or type the phone sends
IMAGE_TYPES = {b"\xff\xd8\xff": "jpg", b"\x89PNG": "png"}


def bad_request(message):
    return jsonify({"error": message}), 400


@mobile_sync.route("/api/mobile/login", methods=["POST"])
def mobile_login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return bad_request("Username and password are required")

    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute(
        "SELECT * FROM users WHERE username = %s OR email = %s",
        (username, username),
    )
    user = cursor.fetchone()
    if not user or not verify_password(password, user["password_hash"]):
        cursor.close()
        connection.close()
        return jsonify({"error": "Invalid username or password"}), 401

    farmer_id = None
    try:
        if is_deactivated(cursor, user):
            return jsonify({"error": DEACTIVATED}), 403
        if user["role"] == "farmer":
            # The phone's own farmer ID (from before sign in) joins this account: it becomes
            # the account's farmer ID, or its scans move into the one the account already has.
            farmer_id = claim_phone_farmer(cursor, user["id"], user["name"], data.get("device_token"))
            connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()

    token = create_access_token(identity=str(user["id"]), expires_delta=TOKEN_LIFETIME)
    return jsonify({"access_token": token, "user": {**user_json(user), "farmer_id": farmer_id}}), 200


@mobile_sync.route("/api/mobile/device", methods=["POST"])
def register_phone():
    """A phone used without an account gets its own farmer ID, so its scans can sync before
    anyone signs in. The token only uploads scans for that farmer ID, and it stops working
    once the farmer ID is connected to an account."""
    connection = get_connection()
    cursor = connection.cursor()
    try:
        farmer_id = add_farmer(cursor, None, None)
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()

    token = create_access_token(
        identity=f"device:{farmer_id}", expires_delta=PHONE_TOKEN_LIFETIME, additional_claims={"device": True}
    )
    return jsonify({"farmer_id": farmer_id, "device_token": token}), 201


def read_scan(form):
    """Check the form fields. Returns (scan, error); exactly one of them is None."""
    try:
        scan_uuid = str(uuidlib.UUID((form.get("scan_uuid") or "").strip()))
        confidence = float(form.get("confidence"))
        latitude = float(form.get("latitude"))
        longitude = float(form.get("longitude"))
        scanned_at = datetime.fromisoformat(form.get("scanned_at") or "")
    except (TypeError, ValueError):
        return None, "scan_uuid, confidence, latitude, longitude and scanned_at must be valid"

    if not 0 <= confidence <= 1:
        return None, "confidence must be between 0 and 1"
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return None, "latitude or longitude is out of range"

    predicted = form.get("predicted_label")
    second = form.get("second_label") or None
    farmer_label = form.get("farmer_label") or None
    feedback = form.get("farmer_feedback") or None
    if predicted not in LABELS or (second and second not in LABELS):
        return None, "Unknown disease label"
    if farmer_label and farmer_label not in LABELS:
        return None, "Unknown disease label"
    if feedback is not None and feedback not in FEEDBACK:
        return None, "farmer_feedback must be 'correct' or 'incorrect'"

    second_confidence = form.get("second_confidence")
    try:
        second_confidence = float(second_confidence) if second_confidence not in (None, "") else None
    except ValueError:
        return None, "second_confidence must be a number"

    source = form.get("image_source")
    return {
        "scan_uuid": scan_uuid,
        "farm_name": (form.get("farm_name") or "").strip()[:150] or None,
        "municipality": (form.get("municipality") or "").strip()[:100] or None,
        "latitude": latitude,
        "longitude": longitude,
        # the database keeps local time without a zone
        "scanned_at": scanned_at.replace(tzinfo=None, microsecond=0),
        "predicted_label": predicted,
        "confidence": confidence,
        "second_label": second,
        "second_confidence": second_confidence,
        "image_source": source if source in IMAGE_SOURCES else "Camera",
        "notes": (form.get("notes") or "").strip() or None,
        "farmer_feedback": feedback,
        "farmer_label": farmer_label,
    }, None


def save_photo(upload, scan_uuid):
    """Store the photo under a name made from the scan_uuid. Returns the file name or None."""
    head = upload.stream.read(8)
    upload.stream.seek(0)
    extension = next((ext for magic, ext in IMAGE_TYPES.items() if head.startswith(magic)), None)
    if extension is None:
        return None

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"{scan_uuid}.{extension}"
    upload.save(os.path.join(UPLOAD_DIR, filename))
    return filename


@mobile_sync.route("/api/mobile/scans", methods=["POST"])
@jwt_required()
def upload_scan():
    scan, error = read_scan(request.form)
    if error:
        return bad_request(error)

    connection = get_connection()
    cursor = connection.cursor()

    def refuse(message, status):
        cursor.close()
        connection.close()
        return jsonify({"error": message}), status

    if get_jwt().get("device"):
        # A phone without an account: its own farmer row, as long as no account has it yet.
        # Once it is connected to an account, the phone signs in and uses that instead.
        cursor.execute(
            "SELECT farmer_id, farm_name, municipality, farm_latitude, is_active FROM farmers "
            "WHERE farmer_id = %s AND user_id IS NULL",
            (get_jwt_identity().removeprefix("device:"),),
        )
        farm = cursor.fetchone()
        if not farm:
            return refuse("This phone's farmer ID now belongs to an account. Sign in to sync.", 401)
        if not farm["is_active"]:
            return refuse(DEACTIVATED, 403)
    else:
        cursor.execute("SELECT id, username, name, role FROM users WHERE id = %s", (get_jwt_identity(),))
        user = cursor.fetchone()
        if not user:
            return refuse("Account not found", 401)
        if user["role"] != "farmer":
            return refuse("Only farmer accounts can sync scans", 403)

        # The phone keeps its 30-day token, so check here too, not only at sign-in
        if is_deactivated(cursor, user):
            return refuse(DEACTIVATED, 403)

        # the farmer's own farmers row, linked to this account by user_id
        cursor.execute(
            "SELECT farmer_id, farm_name, municipality, farm_latitude FROM farmers WHERE user_id = %s",
            (user["id"],),
        )
        farm = cursor.fetchone()
        if not farm:
            return refuse("This account is not linked to a farm. Contact your agricultural officer.", 403)

    # A scan that already exists can only be updated by the farmer who took it
    cursor.execute("SELECT farmer_id FROM mobile_scans WHERE scan_uuid = %s", (scan["scan_uuid"],))
    existing = cursor.fetchone()
    if existing and existing["farmer_id"] != farm["farmer_id"]:
        return refuse("This scan belongs to another account", 403)

    photo = request.files.get("image")
    image_path = ""
    if photo:
        image_path = save_photo(photo, scan["scan_uuid"])
        if image_path is None:
            return refuse("The photo must be a JPG or PNG", 415)

    # A farmer who signed up has a blank farm. Fill in what is still blank from this scan:
    # the farm name and municipality from the phone's settings, the location from the scan.
    blanks = {}
    if not farm["farm_name"] and scan["farm_name"]:
        blanks["farm_name"] = scan["farm_name"]
    if not farm["municipality"] and scan["municipality"]:
        blanks["municipality"] = scan["municipality"]
    if farm["farm_latitude"] is None:
        blanks["farm_latitude"] = scan["latitude"]
        blanks["farm_longitude"] = scan["longitude"]

    now = datetime.now().replace(microsecond=0)
    # Roll back on any error: a half-done save would keep the farmers row locked
    # and every later save would wait on it.
    try:
        if blanks:
            cursor.execute(
                "UPDATE farmers SET " + ", ".join(f"{column} = %s" for column in blanks) + " WHERE farmer_id = %s",
                (*blanks.values(), farm["farmer_id"]),
            )
        cursor.execute(
            """
            INSERT INTO mobile_scans
            (scan_uuid, farmer_id, farm_name, municipality, latitude, longitude, scanned_at,
             predicted_label, confidence, second_label, second_confidence,
             image_source, image_path, synced_at, notes, farmer_feedback, farmer_label)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
              farm_name = VALUES(farm_name),
              municipality = VALUES(municipality),
              notes = VALUES(notes),
              farmer_feedback = VALUES(farmer_feedback),
              farmer_label = VALUES(farmer_label),
              image_path = IF(VALUES(image_path) = '', image_path, VALUES(image_path)),
              synced_at = VALUES(synced_at)
            """,
            (
                scan["scan_uuid"], farm["farmer_id"], scan["farm_name"], scan["municipality"],
                scan["latitude"], scan["longitude"], scan["scanned_at"],
                scan["predicted_label"], scan["confidence"],
                scan["second_label"], scan["second_confidence"],
                scan["image_source"], image_path, now, scan["notes"],
                scan["farmer_feedback"], scan["farmer_label"],
            ),
        )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()

    return jsonify({"scan_uuid": scan["scan_uuid"], "synced_at": now.isoformat()}), 200


@mobile_sync.route("/api/mobile/scans", methods=["GET"])
@jwt_required()
def my_scans():
    """The farmer's own scans, for the dashboard in the app. Same tokens as uploading: a farmer
    account, or a phone that has not signed in yet. Never another farmer's scans."""
    connection = get_connection()
    cursor = connection.cursor()
    try:
        if get_jwt().get("device"):
            cursor.execute(
                "SELECT farmer_id, is_active FROM farmers WHERE farmer_id = %s AND user_id IS NULL",
                (get_jwt_identity().removeprefix("device:"),),
            )
            farm = cursor.fetchone()
            if not farm:
                return jsonify({"error": "This phone's farmer ID now belongs to an account. Sign in to see your scans."}), 401
            if not farm["is_active"]:
                return jsonify({"error": DEACTIVATED}), 403
        else:
            cursor.execute("SELECT id, username, name, role FROM users WHERE id = %s", (get_jwt_identity(),))
            user = cursor.fetchone()
            if not user:
                return jsonify({"error": "Account not found"}), 401
            if user["role"] != "farmer":
                return jsonify({"error": "Only farmer accounts have scans"}), 403
            if is_deactivated(cursor, user):
                return jsonify({"error": DEACTIVATED}), 403
            cursor.execute("SELECT farmer_id FROM farmers WHERE user_id = %s", (user["id"],))
            farm = cursor.fetchone()
            if not farm:
                return jsonify({"error": "This account is not linked to a farm. Contact your agricultural officer."}), 403

        cursor.execute(
            """
            SELECT scan_uuid, scanned_at, latitude, longitude,
                   COALESCE(verified_label, farmer_label, predicted_label) AS label
            FROM mobile_scans
            WHERE farmer_id = %s
            ORDER BY scanned_at DESC
            """,
            (farm["farmer_id"],),
        )
        rows = cursor.fetchall()
    finally:
        cursor.close()
        connection.close()

    scans = [
        {
            "scan_uuid": row["scan_uuid"],
            "label": row["label"],
            "scanned_at": row["scanned_at"].isoformat(),
            # DECIMAL columns come back as Decimal, which JSON cannot hold
            "latitude": float(row["latitude"]),
            "longitude": float(row["longitude"]),
        }
        for row in rows
    ]
    return jsonify({"scans": scans}), 200
