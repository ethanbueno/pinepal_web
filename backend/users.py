from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from security import hash_password, verify_password

from database import get_connection
from permissions import admin_required

users = Blueprint(
    "users",
    __name__
)

@users.route("/api/users", methods=["POST"])
@admin_required
def create_users():

    data = request.get_json(silent=True) or {}

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    role = data.get("role", "user")

    if not name or not email or not password:
        return jsonify({
            "message": "All fields are required"
        }), 400

    if role not in ("user", "admin"):
        return jsonify({
            "message": "Invalid role"
        }), 400

    connection = get_connection()
    cursor = connection.cursor()

    sql = """
        SELECT id
        FROM users
        WHERE email = %s
    """

    cursor.execute(sql, (email,))
    existing_user = cursor.fetchone()

    if existing_user:
        cursor.close()
        connection.close()

        return jsonify({
            "message": "Email already exists"
        }), 409

    hashed_password = hash_password(
        password
    )

    sql = """
        INSERT INTO users
        (name, email, password_hash, role)
        VALUES (%s, %s, %s, %s)
    """
    cursor.execute(
        sql,
        (
            name,
            email,
            hashed_password,
            role
        )
    )

    connection.commit()
    user_id = cursor.lastrowid

    cursor.close()
    connection.close()

    return jsonify({
        "message": "User created successfully",
        "id": user_id
    }), 201

@users.route("/api/me", methods=["GET"])
@jwt_required()
def get_me():

    user_id = get_jwt_identity()

    connection = get_connection()
    cursor = connection.cursor()

    sql = """
        SELECT
            id,
            name,
            email,
            role,
            created_at
        FROM users
        WHERE id = %s
    """
    cursor.execute(
        sql,
        (user_id,)
    )

    user = cursor.fetchone()
    cursor.close()
    connection.close()

    if not user:
        return jsonify({
            "message": "User not found"
        }), 404

    return jsonify(user), 200

@users.route("/api/users", methods=["GET"])
@admin_required
def get_all_users():

    connection = get_connection()
    cursor = connection.cursor()

    sql = """
        SELECT
            id,
            name,
            email,
            role
        FROM users
        ORDER BY id DESC
    """

    cursor.execute(sql)
    users = cursor.fetchall()

    cursor.close()
    connection.close()

    return jsonify(users), 200

@users.route("/api/users/<int:id>", methods=["GET"])
@admin_required
def get_users(id):

    connection = get_connection()
    cursor = connection.cursor()

    sql = """
        SELECT
            id,
            name,
            email
        FROM users
        WHERE id = %s
    """
    cursor.execute(
        sql,
        (id,)
    )

    user = cursor.fetchone()
    cursor.close()
    connection.close()

    if not user:
        return jsonify({
            "message": "User not found"
        }), 404

    return jsonify(user), 200

@users.route("/api/users/<int:id>", methods=["PUT"])
@admin_required
def update_user(id):

    data = request.get_json(silent=True) or {}

    name = data.get("name")
    email = data.get("email")

    if not name or not email:
        return jsonify({
            "message": "Name and email are required"
        }), 400

    connection = get_connection()
    cursor = connection.cursor()

    sql = """
        SELECT id
        FROM users
        WHERE id = %s
    """
    cursor.execute(
        sql,
        (id,)
    )

    user = cursor.fetchone()

    if not user:

        cursor.close()
        connection.close()

        return jsonify({
            "message": "User not found"
        }), 404

    sql = """
        SELECT id
        FROM users
        WHERE email = %s AND id != %s
    """
    cursor.execute(
        sql,
        (
            email,
            id
        )
    )

    if cursor.fetchone():

        cursor.close()
        connection.close()

        return jsonify({
            "message": "Email already exists"
        }), 409

    sql = """
        UPDATE users
        SET
            name = %s,
            email = %s
        WHERE id = %s
    """
    cursor.execute(
        sql,
        (
            name,
            email,
            id
        )
    )

    connection.commit()
    cursor.close()
    connection.close()

    return jsonify({
        "message": "User updated successfully"
    }), 200

@users.route("/api/users/<int:id>", methods=["DELETE"])
@admin_required
def delete_user(id):

    connection = get_connection()
    cursor = connection.cursor()

    # The schema has no ON DELETE CASCADE, so remove dependent rows first.
    cursor.execute(
        "DELETE FROM admin_reviews WHERE reviewer_id = %s OR scan_id IN "
        "(SELECT id FROM scans WHERE user_id = %s)",
        (id, id)
    )
    cursor.execute("DELETE FROM scans WHERE user_id = %s", (id,))

    cursor.execute(
        "DELETE FROM users WHERE id = %s",
        (id,)
    )


    connection.commit()
    affected_rows = cursor.rowcount
    cursor.close()
    connection.close()

    if affected_rows == 0:
        return jsonify({
            "message": "User not found"
        }), 404

    return jsonify({
        "message": "User deleted successfully"
    }), 200