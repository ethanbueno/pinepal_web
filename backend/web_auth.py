import re

from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

from database import get_connection
from farmers import LOCKED_MUNICIPALITY, add_farmer, claim_phone_farmer, sync_user_municipality
from security import hash_password, verify_password

# Login for the web dashboard (matches the API contract in CLAUDEweb.md).
# Errors are returned as { "error": "message" }.
web_auth = Blueprint("web_auth", __name__)

ROLES = ("admin", "officer", "farmer")
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
DEACTIVATED = "This account is deactivated. Contact your agricultural officer."


def is_deactivated(cursor, user):
    """True for a farmer whose farm was deactivated on the Farmers page.

    Farmers are deactivated instead of deleted, so their scans stay in the system.
    """
    if user["role"] != "farmer":
        return False
    cursor.execute("SELECT is_active FROM farmers WHERE user_id = %s", (user["id"],))
    farm = cursor.fetchone()
    return bool(farm) and not farm["is_active"]


def user_json(row):
    return {
        "id": row["id"],
        "full_name": row["name"],
        "username": row["username"],
        "role": row["role"],
    }


@web_auth.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    connection = get_connection()
    cursor = connection.cursor()
    # the login box accepts either the username or the email
    cursor.execute(
        "SELECT * FROM users WHERE username = %s OR email = %s",
        (username, username),
    )
    user = cursor.fetchone()
    blocked = bool(user) and is_deactivated(cursor, user)
    cursor.close()
    connection.close()

    if not user or not verify_password(password, user["password_hash"]):
        return jsonify({"error": "Invalid username or password"}), 401
    if blocked:
        return jsonify({"error": DEACTIVATED}), 403

    token = create_access_token(identity=str(user["id"]))
    return jsonify({"access_token": token, "user": user_json(user)}), 200


@web_auth.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    full_name = (data.get("full_name") or "").strip()
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""
    role = data.get("role") or "farmer"

    if not full_name or not username or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    if len(email) > 150 or not EMAIL_PATTERN.match(email):
        return jsonify({"error": "Enter a valid email address"}), 400

    if role not in ROLES:
        return jsonify({"error": "Invalid role"}), 400

    # Anyone can reach this route, so it only ever creates farmers.
    # Admins and officers are created by an existing admin (Users page).
    if role != "farmer":
        return jsonify({"error": "Sign up can only create farmer accounts"}), 403

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
    if cursor.fetchone():
        cursor.close()
        connection.close()
        return jsonify({"error": "Username is already taken"}), 409

    cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
    if cursor.fetchone():
        cursor.close()
        connection.close()
        return jsonify({"error": "Email is already in use"}), 409

    # Every farmer account gets its farmers row in the same step. Signing up on a phone that
    # already has its own farmer ID (device_token) keeps that ID and its scans. Otherwise
    # the account gets the next farmer ID with blank farm details, which the first sync fills in.
    try:
        cursor.execute(
            "INSERT INTO users (name, username, email, password_hash, role) VALUES (%s, %s, %s, %s, %s)",
            (full_name, username, email, hash_password(password), role),
        )
        user_id = cursor.lastrowid
        farmer_id = claim_phone_farmer(cursor, user_id, full_name, data.get("device_token"))
        if not farmer_id:
            farmer_id = add_farmer(cursor, user_id, full_name)
        # the sign-up form's municipality is locked to Echague, for a new or a claimed farm,
        # and the account gets the same one
        cursor.execute(
            "UPDATE farmers SET municipality = %s WHERE user_id = %s", (LOCKED_MUNICIPALITY, user_id)
        )
        sync_user_municipality(cursor, farmer_id)
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()

    return jsonify({
        "id": user_id,
        "full_name": full_name,
        "username": username,
        "email": email,
        "role": role,
    }), 201


@web_auth.route("/api/auth/me", methods=["GET"])
@jwt_required()
def me():
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("SELECT * FROM users WHERE id = %s", (get_jwt_identity(),))
    user = cursor.fetchone()
    cursor.close()
    connection.close()

    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify(user_json(user)), 200
