"""Farmers for the dashboard: the Farmers pages, "Save as scan" and the farmer's own farm page.

GET   /api/farmers               list (filters: search, municipality, status), staff only
GET   /api/farmers/me            the farm of the signed-in farmer account (null if none)
GET   /api/farmers/<id>          one farmer with scans per disease, staff only
POST  /api/farmers               add a farmer and their login account, staff only
PUT   /api/farmers/<id>          edit a farmer (an optional password creates / resets the login)
PATCH /api/farmers/<id>/status   activate or deactivate

A farmer's login username is their farmer ID. That is also what the mobile sync stores in
mobile_scans.farmer_id, so the scans and the farmer line up without any extra link.
Errors are { "error": "message" }.
"""
import re

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from database import get_connection
from permissions import staff_required
from security import hash_password

farmers = Blueprint("farmers", __name__)

LABELS = ["No_Disease", "Crown_Rot", "Mealybug_Wilt", "Fruit_Rot", "Multiple_Crown", "Fruit_Fasciation"]
USERNAME = re.compile(r"[A-Za-z0-9_.-]{3,50}")
MIN_PASSWORD = 6

# Isabela, with a little room: a farm pin outside this is a mistake
LAT_RANGE = (16.3, 17.7)
LNG_RANGE = (121.2, 122.7)

SELECT = """
    SELECT f.*,
           (SELECT COUNT(*) FROM mobile_scans s WHERE s.farmer_id = f.farmer_id) AS total_scans,
           EXISTS(SELECT 1 FROM users u WHERE u.username = f.farmer_id AND u.role = 'farmer') AS has_account
    FROM farmers f
"""


def serialize(row):
    return {
        "farmer_id": row["farmer_id"],
        "full_name": row["full_name"],
        "farm_name": row["farm_name"],
        "municipality": row["municipality"],
        "farm_latitude": float(row["farm_latitude"]),
        "farm_longitude": float(row["farm_longitude"]),
        "farm_size_ha": float(row["farm_size_ha"]) if row["farm_size_ha"] is not None else None,
        "username": row["farmer_id"] if row["has_account"] else None,
        "has_account": bool(row["has_account"]),
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
    municipality = (data.get("municipality") or "").strip()
    if not full_name or not farm_name or not municipality:
        return None, "Full name, farm name and municipality are required"
    if len(full_name) > 100 or len(farm_name) > 150 or len(municipality) > 100:
        return None, "A field is too long"

    try:
        latitude = float(data.get("farm_latitude"))
        longitude = float(data.get("farm_longitude"))
    except (TypeError, ValueError):
        return None, "Farm location must be a latitude and a longitude"
    if not (LAT_RANGE[0] <= latitude <= LAT_RANGE[1] and LNG_RANGE[0] <= longitude <= LNG_RANGE[1]):
        return None, "The farm location is outside Isabela"

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
    cursor.execute("SELECT username, role FROM users WHERE id = %s", (get_jwt_identity(),))
    user = cursor.fetchone()
    row = fetch_one(cursor, user["username"]) if user and user["role"] == "farmer" else None
    cursor.close()
    connection.close()
    return jsonify(serialize(row) if row else None), 200


@farmers.route("/api/farmers/<farmer_id>", methods=["GET"])
@staff_required
def get_farmer(farmer_id):
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
        taken = cursor.fetchone()
        cursor.execute("SELECT 1 FROM farmers WHERE farmer_id = %s", (username,))
        taken = taken or cursor.fetchone()
        if taken:
            return error("That username is already taken", 409)

        # the username is the farmer ID, so scans from the phone find this farmer
        cursor.execute(
            "INSERT INTO users (name, username, password_hash, role) VALUES (%s, %s, %s, 'farmer')",
            (fields["full_name"], username, hash_password(password)),
        )
        cursor.execute(
            "INSERT INTO farmers (farmer_id, full_name, farm_name, municipality, farm_latitude, farm_longitude, farm_size_ha) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (username, fields["full_name"], fields["farm_name"], fields["municipality"],
             fields["farm_latitude"], fields["farm_longitude"], fields["farm_size_ha"]),
        )
        connection.commit()
        row = fetch_one(cursor, username)
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

    connection = get_connection()
    cursor = connection.cursor()
    try:
        if not fetch_one(cursor, farmer_id):
            return error("Farmer not found", 404)

        cursor.execute(
            "UPDATE farmers SET full_name = %s, farm_name = %s, municipality = %s, "
            "farm_latitude = %s, farm_longitude = %s, farm_size_ha = %s WHERE farmer_id = %s",
            (fields["full_name"], fields["farm_name"], fields["municipality"],
             fields["farm_latitude"], fields["farm_longitude"], fields["farm_size_ha"], farmer_id),
        )

        cursor.execute("SELECT id, role FROM users WHERE username = %s", (farmer_id,))
        account = cursor.fetchone()
        if account and account["role"] != "farmer":
            return error("That username belongs to a staff account", 409)

        if account:
            # keep the login's display name in step, and reset the password when one is given
            if password:
                cursor.execute(
                    "UPDATE users SET name = %s, password_hash = %s WHERE id = %s",
                    (fields["full_name"], hash_password(password), account["id"]),
                )
            else:
                cursor.execute("UPDATE users SET name = %s WHERE id = %s", (fields["full_name"], account["id"]))
        elif password:
            # a farmer who came from the scan data has no login yet; the username is the farmer ID
            cursor.execute(
                "INSERT INTO users (name, username, password_hash, role) VALUES (%s, %s, %s, 'farmer')",
                (fields["full_name"], farmer_id, hash_password(password)),
            )

        connection.commit()
        row = fetch_one(cursor, farmer_id)
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()

    return jsonify(serialize(row)), 200


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
