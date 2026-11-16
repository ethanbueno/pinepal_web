from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token

from security import LOGIN_SELECT, set_password, verify_password

from database import get_connection
auth = Blueprint("auth", __name__)

@auth.route("/api/register", methods=["POST"])
def register():

    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    password = data.get("password")

    if not name or not email or not password:
        return jsonify({
            "message": "All fields are required"
        }), 400

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT id FROM users WHERE email = %s",
        (email,)
    )
    if cursor.fetchone():
        cursor.close()
        connection.close()

        return jsonify({
            "message": "Email already exists"
        }), 409

    # Public registration always creates a regular user.
    cursor.execute(
        """
        INSERT INTO users
        (name, email, role)
        VALUES (%s, %s, 'user')
        """,
        (name, email)
    )
    set_password(cursor, cursor.lastrowid, password)

    connection.commit()
    cursor.close()
    connection.close()

    return jsonify({
        "message": "Registration successful"
    }), 201


@auth.route("/api/login", methods=["POST"])
def login():

    data = request.get_json(silent=True) or {}

    email = data.get("email")
    password = data.get("password")

    if not email or not password:

        return jsonify({
            "message": "Email and password are required"
        }), 400

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        LOGIN_SELECT + " WHERE u.email = %s",
        (email,)
    )

    user = cursor.fetchone()
    cursor.close()
    connection.close()

    if not user or not verify_password(password, user["password_hash"]):
        return jsonify({
            "message": "Invalid email or password"
        }), 401

    token = create_access_token(
        identity=str(user["id"])
    )

    return jsonify({
        "message": "Login successful",
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"]
        }
    }), 200
