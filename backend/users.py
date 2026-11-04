from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from security import hash_password

from database import get_connection
from permissions import admin_required

# Accounts for the web dashboard's Users page (admin only).
# Users are { id, full_name, username, email, role, created_at }; errors are { "error": "message" }.
users = Blueprint(
    "users",
    __name__
)

ROLES = ("admin", "officer", "farmer")
COLUMNS = "id, name, username, email, role, created_at"
FARMERS_TAB = "Add farmers from the Farmers tab, together with their farm."


def user_json(row):
    return {
        "id": row["id"],
        "full_name": row["name"],
        "username": row["username"],
        "email": row["email"],
        "role": row["role"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }


def find_user(cursor, id):
    cursor.execute(f"SELECT {COLUMNS} FROM users WHERE id = %s", (id,))
    return cursor.fetchone()


def read_form(data, creating):
    """Validate the Add/Edit user form. Returns (fields, error)."""
    full_name = (data.get("full_name") or "").strip()
    username = (data.get("username") or "").strip()
    role = data.get("role") or "officer"
    password = data.get("password") or ""

    if not full_name or not username or (creating and not password):
        return None, "Full name, username and password are required" if creating else "Full name and username are required"
    if role not in ROLES:
        return None, "Invalid role"
    return {"full_name": full_name, "username": username, "role": role, "password": password}, None


@users.route("/api/users", methods=["GET"])
@admin_required
def get_all_users():

    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute(f"SELECT {COLUMNS} FROM users ORDER BY created_at DESC, id DESC")
    rows = cursor.fetchall()
    cursor.close()
    connection.close()

    return jsonify([user_json(r) for r in rows]), 200


@users.route("/api/users", methods=["POST"])
@admin_required
def create_user():

    form, error = read_form(request.get_json(silent=True) or {}, creating=True)
    if error:
        return jsonify({"error": error}), 400
    # a farmer account always comes with its farmers row, which the Farmers tab makes
    if form["role"] == "farmer":
        return jsonify({"error": FARMERS_TAB}), 400

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("SELECT id FROM users WHERE username = %s", (form["username"],))
    if cursor.fetchone():
        cursor.close()
        connection.close()
        return jsonify({"error": "Username is already taken"}), 409

    cursor.execute(
        "INSERT INTO users (name, username, password_hash, role) VALUES (%s, %s, %s, %s)",
        (form["full_name"], form["username"], hash_password(form["password"]), form["role"]),
    )
    connection.commit()
    user = find_user(cursor, cursor.lastrowid)
    cursor.close()
    connection.close()

    return jsonify(user_json(user)), 201


@users.route("/api/users/<int:id>", methods=["GET"])
@admin_required
def get_user(id):

    connection = get_connection()
    cursor = connection.cursor()
    user = find_user(cursor, id)
    cursor.close()
    connection.close()

    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify(user_json(user)), 200


@users.route("/api/users/<int:id>", methods=["PUT"])
@admin_required
def update_user(id):

    form, error = read_form(request.get_json(silent=True) or {}, creating=False)
    if error:
        return jsonify({"error": error}), 400

    # an admin can't remove their own admin role and lock themselves out
    if str(id) == get_jwt_identity() and form["role"] != "admin":
        return jsonify({"error": "You can't change your own role"}), 400

    connection = get_connection()
    cursor = connection.cursor()

    current = find_user(cursor, id)
    if not current:
        cursor.close()
        connection.close()
        return jsonify({"error": "User not found"}), 404

    # switching to or from farmer would leave a farmer without a farm, or staff with one
    if (current["role"] == "farmer") != (form["role"] == "farmer"):
        cursor.close()
        connection.close()
        return jsonify({"error": "A farmer account can't change role. " + FARMERS_TAB}), 400

    cursor.execute("SELECT id FROM users WHERE username = %s AND id != %s", (form["username"], id))
    if cursor.fetchone():
        cursor.close()
        connection.close()
        return jsonify({"error": "Username is already taken"}), 409

    cursor.execute(
        "UPDATE users SET name = %s, username = %s, role = %s WHERE id = %s",
        (form["full_name"], form["username"], form["role"], id),
    )
    # a farmer's linked farmers row takes the new name; its farmer ID and farm stay the same
    cursor.execute("UPDATE farmers SET full_name = %s WHERE user_id = %s", (form["full_name"], id))
    # the password only changes when a new one is typed
    if form["password"]:
        cursor.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s",
            (hash_password(form["password"]), id),
        )
    connection.commit()
    user = find_user(cursor, id)
    cursor.close()
    connection.close()

    return jsonify(user_json(user)), 200


@users.route("/api/users/<int:id>", methods=["DELETE"])
@admin_required
def delete_user(id):

    if str(id) == get_jwt_identity():
        return jsonify({"error": "You can't delete your own account"}), 400

    connection = get_connection()
    cursor = connection.cursor()

    # A farmer's scans stay in the system for good, so a farmer who has scans is
    # deactivated on the Farmers page instead of deleted.
    cursor.execute(
        "SELECT COUNT(*) AS n FROM mobile_scans s JOIN farmers f ON f.farmer_id = s.farmer_id "
        "WHERE f.user_id = %s",
        (id,)
    )
    scan_count = cursor.fetchone()["n"]
    if scan_count:
        cursor.close()
        connection.close()
        return jsonify({
            "error": f"This farmer has {scan_count} scans. Deactivate them on the Farmers page instead."
        }), 409

    # The schema has no ON DELETE CASCADE, so remove dependent rows first.
    cursor.execute(
        "DELETE FROM admin_reviews WHERE reviewer_id = %s OR scan_id IN "
        "(SELECT id FROM scans WHERE user_id = %s)",
        (id, id)
    )
    cursor.execute("DELETE FROM scans WHERE user_id = %s", (id,))
    cursor.execute("DELETE FROM users WHERE id = %s", (id,))

    connection.commit()
    affected_rows = cursor.rowcount
    cursor.close()
    connection.close()

    if affected_rows == 0:
        return jsonify({"error": "User not found"}), 404

    return "", 204


@users.route("/api/me", methods=["GET"])
@jwt_required()
def get_me():

    connection = get_connection()
    cursor = connection.cursor()
    user = find_user(cursor, get_jwt_identity())
    cursor.close()
    connection.close()

    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify(user_json(user)), 200
