from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

from database import get_connection
from security import hash_password, verify_password

# Login for the web dashboard (matches the API contract in CLAUDEweb.md).
# Errors are returned as { "error": "message" }.
web_auth = Blueprint("web_auth", __name__)

ROLES = ("admin", "officer", "farmer")


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
    cursor.close()
    connection.close()

    if not user or not verify_password(password, user["password_hash"]):
        return jsonify({"error": "Invalid username or password"}), 401

    token = create_access_token(identity=str(user["id"]))
    return jsonify({"access_token": token, "user": user_json(user)}), 200


@web_auth.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    full_name = (data.get("full_name") or "").strip()
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    role = data.get("role") or "farmer"

    if not full_name or not username or not password:
        return jsonify({"error": "All fields are required"}), 400

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

    cursor.execute(
        "INSERT INTO users (name, username, password_hash, role) VALUES (%s, %s, %s, %s)",
        (full_name, username, hash_password(password), role),
    )
    connection.commit()
    user_id = cursor.lastrowid
    cursor.close()
    connection.close()

    return jsonify({
        "id": user_id,
        "full_name": full_name,
        "username": username,
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
