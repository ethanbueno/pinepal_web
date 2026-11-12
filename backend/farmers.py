"""Farmers for the dashboard: the Farmers pages, "Save as scan" and the farmer's own farm page.

GET   /api/farmers               list (filters: search, municipality, status), staff only
GET   /api/farmers/me            the farm of the signed-in farmer account (null if none)
GET   /api/farmers/<id>          one farmer with scans per disease, staff or that farmer
POST  /api/farmers               add a farmer and their login account, staff only
PUT   /api/farmers/<id>          edit a farmer (an optional password creates / resets the login)
PATCH /api/farmers/<id>/status   activate or deactivate
POST  /api/farmers/<id>/sync     "Sync now": connect a farmer with no account to an existing
                                 login (merging into its farmer ID) or to a new account

A farmer account is linked to its farmers row by farmers.user_id (one row per account). The
mobile sync finds the row through it and stores scans under that row's farmer_id. Farmers that
came from the scan data have no account until staff set a password for them here.
The farmer ID (F001, F002, ...) is given once and never changes, and it is not the username.
Linking or renaming the account only changes full_name.
A phone used without an account gets its own row (POST /api/mobile/device). Signing up or
logging in on that phone connects the row to the account, or merges it into the account's own
row (see claim_phone_farmer).
Errors are { "error": "message" }.
"""
import re

from flask import Blueprint, jsonify, request
from flask_jwt_extended import decode_token, get_jwt_identity, jwt_required

from database import get_connection
from echague_area import in_echague
from permissions import farmer_scope, role_required, staff_required
from security import hash_password

farmers = Blueprint("farmers", __name__)

LABELS = ["No_Disease", "Crown_Rot", "Mealybug_Wilt", "Fruit_Rot", "Multiple_Crown", "Fruit_Fasciation"]
USERNAME = re.compile(r"[A-Za-z0-9_.-]{3,50}")
MIN_PASSWORD = 6


SELECT = """
    SELECT f.*, u.username,
           (SELECT COUNT(*) FROM mobile_scans s WHERE s.farmer_id = f.farmer_id) AS total_scans
    FROM farmers f
    LEFT JOIN users u ON u.id = f.user_id
"""


LOCKED_MUNICIPALITY = "Echague"  # every account's farm is in Echague (LOCKED_MUNICIPALITY in src/utils/diseases.js)


def sync_user_municipality(cursor, farmer_id):
    """Copy a farm's municipality onto its linked account, so users.municipality always
    matches farmers.municipality. Called after anything that sets a farm's municipality or
    links an account to a farm. A farm without an account changes nothing."""
    cursor.execute(
        "UPDATE users u JOIN farmers f ON f.user_id = u.id SET u.municipality = f.municipality "
        "WHERE f.farmer_id = %s",
        (farmer_id,),
    )


def add_farmer(cursor, user_id, full_name, **farm):
    """Add a farmers row under the next farmer ID (F001, F002, ...) and return that ID.

    The farmer ID is given once and never changes. Linking or renaming the account only
    changes full_name. FOR UPDATE reads the newest ID and holds it, so two sign ups at the
    same moment can't get the same one. Without a name (a phone with no account yet) the
    row is called "Farmer F070".
    """
    cursor.execute(
        "SELECT MAX(CAST(SUBSTRING(farmer_id, 2) AS UNSIGNED)) AS last FROM farmers "
        "WHERE farmer_id REGEXP '^F[0-9]+$' FOR UPDATE"
    )
    farmer_id = f"F{(cursor.fetchone()['last'] or 0) + 1:03d}"
    columns = {"farmer_id": farmer_id, "user_id": user_id, "full_name": full_name or f"Farmer {farmer_id}", **farm}
    cursor.execute(
        f"INSERT INTO farmers ({', '.join(columns)}) VALUES ({', '.join(['%s'] * len(columns))})",
        tuple(columns.values()),
    )
    if user_id:
        sync_user_municipality(cursor, farmer_id)
    return farmer_id


def phone_farmer_id(device_token):
    """The farmer ID inside a phone's token (from POST /api/mobile/device), or None."""
    if not device_token:
        return None
    try:
        claims = decode_token(device_token)
    except Exception:  # broken, expired or signed with another key
        return None
    if not claims.get("device"):
        return None
    return claims["sub"].removeprefix("device:")


def join_account(cursor, farmer_id, user_id, full_name):
    """Connect a farmers row with no account to the farmer account user_id.
    Returns the account's farmer ID, or None when the row is missing or already has an account.

    - The account has no farmers row yet: this row becomes it (same farmer ID, full_name
      from the account, the rest unchanged).
    - The account already has one (F069) and this row is another (F070): F070's scans move
      to F069 and F070 is deleted, so an account never has two farmer IDs.
    Used by the phone (sign up / log in) and by "Sync now" on the Farmers page.
    """
    cursor.execute("SELECT farmer_id FROM farmers WHERE farmer_id = %s AND user_id IS NULL FOR UPDATE", (farmer_id,))
    if not cursor.fetchone():
        return None
    cursor.execute("SELECT farmer_id FROM farmers WHERE user_id = %s", (user_id,))
    own = cursor.fetchone()

    if not own:
        cursor.execute(
            "UPDATE farmers SET user_id = %s, full_name = %s WHERE farmer_id = %s",
            (user_id, full_name, farmer_id),
        )
        sync_user_municipality(cursor, farmer_id)
        return farmer_id

    cursor.execute("UPDATE mobile_scans SET farmer_id = %s WHERE farmer_id = %s", (own["farmer_id"], farmer_id))
    cursor.execute("DELETE FROM farmers WHERE farmer_id = %s", (farmer_id,))
    return own["farmer_id"]


def claim_phone_farmer(cursor, user_id, full_name, device_token):
    """Connect the phone's own farmer row (if any) to the account. Returns the account's farmer ID."""
    phone_id = phone_farmer_id(device_token)
    joined = join_account(cursor, phone_id, user_id, full_name) if phone_id else None
    if joined:
        return joined
    cursor.execute("SELECT farmer_id FROM farmers WHERE user_id = %s", (user_id,))
    own = cursor.fetchone()
    return own["farmer_id"] if own else None


def number(value):
    return float(value) if value is not None else None


def serialize(row):
    return {
        "farmer_id": row["farmer_id"],
        "full_name": row["full_name"],
        "farm_name": row["farm_name"],
        "municipality": row["municipality"],
        # empty until the farmer's first sync, for a farmer who signed up themselves
        "farm_latitude": number(row["farm_latitude"]),
        "farm_longitude": number(row["farm_longitude"]),
        "farm_size_ha": number(row["farm_size_ha"]),
        "username": row["username"],
        "has_account": row["user_id"] is not None,
        "is_active": bool(row["is_active"]),
        "registered_at": row["registered_at"].isoformat(),
        "total_scans": int(row["total_scans"]),
    }


def error(message, status):
    return jsonify({"error": message}), status


def read_fields(data):
    """The farm fields of a form. Returns (fields, error message); exactly one is None."""
    full_name = (data.get("full_name") or "").strip()
    farm_name = (data.get("farm_name") or "").strip()
    municipality = LOCKED_MUNICIPALITY  # the form's field is locked; whatever is sent, it's Echague
    if not full_name or not farm_name:
        return None, "Full name and farm name are required"
    if len(full_name) > 100 or len(farm_name) > 150 or len(municipality) > 100:
        return None, "A field is too long"

    try:
        latitude = float(data.get("farm_latitude"))
        longitude = float(data.get("farm_longitude"))
    except (TypeError, ValueError):
        return None, "Farm location must be a latitude and a longitude"
    # PinePal only covers Echague for now, so the farm pin must be inside its border
    if not in_echague(latitude, longitude):
        return None, "The farm location must be inside Echague. Pin a spot within the Echague border."

    size = data.get("farm_size_ha")
    try:
        size = float(size) if size not in (None, "") else None
    except (TypeError, ValueError):
        return None, "Farm size must be a number"
    if size is not None and not 0 <= size < 10000:
        return None, "Farm size is out of range"

    return {
        "full_name": full_name,
        "farm_name": farm_name,
        "municipality": municipality,
        "farm_latitude": latitude,
        "farm_longitude": longitude,
        "farm_size_ha": size,
    }, None


def fetch_one(cursor, farmer_id):
    cursor.execute(SELECT + " WHERE f.farmer_id = %s", (farmer_id,))
    return cursor.fetchone()


@farmers.route("/api/farmers", methods=["GET"])
@staff_required
def list_farmers():
    where, params = [], []
    if request.args.get("municipality"):
        where.append("f.municipality = %s")
        params.append(request.args["municipality"])
    if request.args.get("status") == "active":
        where.append("f.is_active = 1")
    elif request.args.get("status") == "inactive":
        where.append("f.is_active = 0")
    if request.args.get("search"):
        like = f"%{request.args['search']}%"
        where.append("(f.full_name LIKE %s OR f.farm_name LIKE %s OR f.farmer_id LIKE %s)")
        params += [like, like, like]

    sql = SELECT + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY f.farmer_id"
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute(sql, params)
    rows = cursor.fetchall()
    cursor.close()
    connection.close()
    return jsonify([serialize(r) for r in rows]), 200


@farmers.route("/api/farmers/me", methods=["GET"])
@jwt_required()
def my_farmer():
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute(SELECT + " WHERE f.user_id = %s", (get_jwt_identity(),))
    row = cursor.fetchone()
    cursor.close()
    connection.close()
    return jsonify(serialize(row) if row else None), 200


@farmers.route("/api/farmers/<farmer_id>", methods=["GET"])
@role_required("admin", "officer", "farmer")
def get_farmer(farmer_id):
    # a farmer can open only their own farm (the My Farm page)
    own = farmer_scope(get_jwt_identity())
    if own is not None and own != farmer_id:
        return error("Farmer not found", 404)

    connection = get_connection()
    cursor = connection.cursor()
    row = fetch_one(cursor, farmer_id)
    if not row:
        cursor.close()
        connection.close()
        return error("Farmer not found", 404)

    # the final diagnosis is the officer's verified label, or the prediction when not verified
    cursor.execute(
        "SELECT COALESCE(verified_label, predicted_label) AS label, COUNT(*) AS n "
        "FROM mobile_scans WHERE farmer_id = %s GROUP BY label",
        (farmer_id,),
    )
    counts = {r["label"]: int(r["n"]) for r in cursor.fetchall()}
    cursor.close()
    connection.close()

    farmer = serialize(row)
    farmer["scans_by_disease"] = [{"label": label, "count": counts.get(label, 0)} for label in LABELS]
    return jsonify(farmer), 200


@farmers.route("/api/farmers", methods=["POST"])
@staff_required
def create_farmer():
    data = request.get_json(silent=True) or {}
    fields, problem = read_fields(data)
    if problem:
        return error(problem, 400)

    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if not USERNAME.fullmatch(username):
        return error("Username must be 3 to 50 letters, numbers, dots, dashes or underscores", 400)
    if len(password) < MIN_PASSWORD:
        return error(f"Password must be at least {MIN_PASSWORD} characters", 400)

    connection = get_connection()
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT 1 FROM users WHERE username = %s", (username,))
        if cursor.fetchone():
            return error("That username is already taken", 409)

        # the login and its farmers row are made together and linked by user_id;
        # the farmer gets the next farmer ID, separate from the username
        cursor.execute(
            "INSERT INTO users (name, username, password_hash, role) VALUES (%s, %s, %s, 'farmer')",
            (fields["full_name"], username, hash_password(password)),
        )
        farmer_id = add_farmer(
            cursor, cursor.lastrowid, fields["full_name"],
            farm_name=fields["farm_name"], municipality=fields["municipality"],
            farm_latitude=fields["farm_latitude"], farm_longitude=fields["farm_longitude"],
            farm_size_ha=fields["farm_size_ha"],
        )
        connection.commit()
        row = fetch_one(cursor, farmer_id)
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()

    return jsonify(serialize(row)), 201


@farmers.route("/api/farmers/<farmer_id>", methods=["PUT"])
@staff_required
def update_farmer(farmer_id):
    data = request.get_json(silent=True) or {}
    fields, problem = read_fields(data)
    if problem:
        return error(problem, 400)

    password = data.get("password") or ""
    if password and len(password) < MIN_PASSWORD:
        return error(f"Password must be at least {MIN_PASSWORD} characters", 400)
    username = (data.get("username") or "").strip()

    connection = get_connection()
    cursor = connection.cursor()
    try:
        farmer = fetch_one(cursor, farmer_id)
        if not farmer:
            return error("Farmer not found", 404)

        cursor.execute(
            "UPDATE farmers SET full_name = %s, farm_name = %s, municipality = %s, "
            "farm_latitude = %s, farm_longitude = %s, farm_size_ha = %s WHERE farmer_id = %s",
            (fields["full_name"], fields["farm_name"], fields["municipality"],
             fields["farm_latitude"], fields["farm_longitude"], fields["farm_size_ha"], farmer_id),
        )

        account_id = farmer["user_id"]
        if account_id:
            # keep the login's display name in step, and reset the password when one is given
            if password:
                cursor.execute(
                    "UPDATE users SET name = %s, password_hash = %s WHERE id = %s",
                    (fields["full_name"], hash_password(password), account_id),
                )
            else:
                cursor.execute("UPDATE users SET name = %s WHERE id = %s", (fields["full_name"], account_id))
        elif password:
            # a farmer who came from the scan data has no login yet: make one and link it
            # to this row. The farmer ID stays the same, only the username is new.
            if not USERNAME.fullmatch(username):
                connection.rollback()
                return error("Username must be 3 to 50 letters, numbers, dots, dashes or underscores", 400)
            cursor.execute("SELECT 1 FROM users WHERE username = %s", (username,))
            if cursor.fetchone():
                connection.rollback()
                return error("That username is already taken", 409)
            cursor.execute(
                "INSERT INTO users (name, username, password_hash, role) VALUES (%s, %s, %s, 'farmer')",
                (fields["full_name"], username, hash_password(password)),
            )
            cursor.execute("UPDATE farmers SET user_id = %s WHERE farmer_id = %s", (cursor.lastrowid, farmer_id))

        # the account takes the farm's municipality (after an edit or a new link)
        sync_user_municipality(cursor, farmer_id)
        connection.commit()
        row = fetch_one(cursor, farmer_id)
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()

    return jsonify(serialize(row)), 200


@farmers.route("/api/farmers/<farmer_id>/sync", methods=["POST"])
@staff_required
def sync_farmer(farmer_id):
    """Sync now, for a farmer with no account: connect the row to a login.

    { "username": ... }                                   an existing farmer account. If it already
                                                           has a farmer ID, this row's scans move there
                                                           and this row is deleted.
    { "full_name": ..., "username": ..., "password": ... } sign up a new account; this row keeps its
                                                           farmer ID and becomes the account's.
    Returns the farmer the account ends up with.
    """
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    new_account = bool(password)

    if new_account:
        full_name = (data.get("full_name") or "").strip()
        if not full_name or len(full_name) > 100:
            return error("Full name is required", 400)
        if not USERNAME.fullmatch(username):
            return error("Username must be 3 to 50 letters, numbers, dots, dashes or underscores", 400)
        if len(password) < MIN_PASSWORD:
            return error(f"Password must be at least {MIN_PASSWORD} characters", 400)

    connection = get_connection()
    cursor = connection.cursor()
    try:
        row = fetch_one(cursor, farmer_id)
        if not row:
            return error("Farmer not found", 404)
        if row["user_id"]:
            return error("This farmer is already connected to an account", 409)

        if new_account:
            cursor.execute("SELECT 1 FROM users WHERE username = %s", (username,))
            if cursor.fetchone():
                return error("That username is already taken", 409)
            cursor.execute(
                "INSERT INTO users (name, username, password_hash, role) VALUES (%s, %s, %s, 'farmer')",
                (full_name, username, hash_password(password)),
            )
            user_id = cursor.lastrowid
        else:
            cursor.execute("SELECT id, name, role FROM users WHERE username = %s", (username,))
            account = cursor.fetchone()
            if not account:
                return error("No account with that username", 404)
            if account["role"] != "farmer":
                return error("That account is not a farmer account", 400)
            user_id, full_name = account["id"], account["name"]

        result = join_account(cursor, farmer_id, user_id, full_name)
        connection.commit()
        row = fetch_one(cursor, result)
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()

    farmer = serialize(row)
    farmer["merged_from"] = farmer_id if result != farmer_id else None
    return jsonify(farmer), 200


@farmers.route("/api/farmers/<farmer_id>/status", methods=["PATCH"])
@staff_required
def set_status(farmer_id):
    data = request.get_json(silent=True) or {}
    if not isinstance(data.get("is_active"), bool):
        return error("is_active must be true or false", 400)

    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("UPDATE farmers SET is_active = %s WHERE farmer_id = %s", (int(data["is_active"]), farmer_id))
    connection.commit()
    row = fetch_one(cursor, farmer_id)
    cursor.close()
    connection.close()

    if not row:
        return error("Farmer not found", 404)
    return jsonify(serialize(row)), 200
