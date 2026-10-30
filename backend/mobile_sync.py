"""Routes for the mobile app, which works offline and syncs later.

POST /api/mobile/login   same login as the web, but the token lasts 30 days. The web token
                         is short on purpose; a farmer who scans in the field and syncs days
                         later should not have to sign in again first.
POST /api/mobile/scans   upload one scan (form data, with the photo as the "image" file).
                         Safe to repeat: sending the same scan_uuid again updates the notes
                         and the farmer's feedback instead of making a duplicate.

Any signed-in user can upload; the scan is stored under their username (farmer_id).
Errors are { "error": "message" }.
"""
import os
import uuid as uuidlib
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required

from database import get_connection
from mobile_scans import LABELS
from scans import UPLOAD_DIR
from security import verify_password
from web_auth import user_json

mobile_sync = Blueprint("mobile_sync", __name__)

TOKEN_LIFETIME = timedelta(days=30)
FEEDBACK = ("correct", "incorrect")
IMAGE_SOURCES = ("Camera", "Gallery")

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
    cursor.close()
    connection.close()

    if not user or not verify_password(password, user["password_hash"]):
        return jsonify({"error": "Invalid username or password"}), 401

    token = create_access_token(identity=str(user["id"]), expires_delta=TOKEN_LIFETIME)
    return jsonify({"access_token": token, "user": user_json(user)}), 200


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

    cursor.execute("SELECT username, role FROM users WHERE id = %s", (get_jwt_identity(),))
    user = cursor.fetchone()
    if not user:
        cursor.close()
        connection.close()
        return jsonify({"error": "Account not found"}), 401

    # A scan that already exists can only be updated by the same farmer (or staff)
    cursor.execute("SELECT farmer_id FROM mobile_scans WHERE scan_uuid = %s", (scan["scan_uuid"],))
    existing = cursor.fetchone()
    if existing and existing["farmer_id"] != user["username"] and user["role"] == "farmer":
        cursor.close()
        connection.close()
        return jsonify({"error": "This scan belongs to another account"}), 403

    photo = request.files.get("image")
    image_path = ""
    if photo:
        image_path = save_photo(photo, scan["scan_uuid"])
        if image_path is None:
            cursor.close()
            connection.close()
            return jsonify({"error": "The photo must be a JPG or PNG"}), 415

    now = datetime.now().replace(microsecond=0)
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
            scan["scan_uuid"], user["username"], scan["farm_name"], scan["municipality"],
            scan["latitude"], scan["longitude"], scan["scanned_at"],
            scan["predicted_label"], scan["confidence"],
            scan["second_label"], scan["second_confidence"],
            scan["image_source"], image_path, now, scan["notes"],
            scan["farmer_feedback"], scan["farmer_label"],
        ),
    )
    connection.commit()
    cursor.close()
    connection.close()

    return jsonify({"scan_uuid": scan["scan_uuid"], "synced_at": now.isoformat()}), 200
