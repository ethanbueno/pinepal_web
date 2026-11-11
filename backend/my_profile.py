"""The signed-in user's own profile, for the web Profile page and the mobile app.

GET  /api/profile           the account, and for a farmer their farm, straight from the database
PUT  /api/profile           change the few things a user may change about themselves:
                              everyone:      full_name
                              farmers also:  farm_name, farm_size_ha
                            Anything else in the body is ignored, so the important details
                            (username, email, role, farmer ID, municipality, farm location,
                            account status) can only be changed by an admin or officer.
POST /api/profile/password  change the password; the current one must be given first

Every role can use these, but only for their own account. A phone's device token has no
account, so it gets 403. Errors are { "error": "message" }.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity

from database import get_connection
from farmers import MIN_PASSWORD, SELECT, serialize as farm_json
from permissions import role_required
from security import hash_password, verify_password

profile = Blueprint("profile", __name__)

ANY_ROLE = ("admin", "officer", "farmer")


def error(message, status=400):
    return jsonify({"error": message}), status


def load(cursor, user_id):
    """The profile as the API sends it: { account, farm } (farm is null for staff)."""
    cursor.execute("SELECT id, name, username, email, role, created_at FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone()
    farm = None
    if user["role"] == "farmer":
        cursor.execute(SELECT + " WHERE f.user_id = %s", (user_id,))
        row = cursor.fetchone()
        farm = farm_json(row) if row else None
    return {
        "account": {
            "id": user["id"],
            "full_name": user["name"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
            "created_at": user["created_at"].isoformat() if user["created_at"] else None,
        },
        "farm": farm,
    }


@profile.route("/api/profile", methods=["GET"])
@role_required(*ANY_ROLE)
def get_profile():
    connection = get_connection()
    cursor = connection.cursor()
    data = load(cursor, get_jwt_identity())
    cursor.close()
    connection.close()
    return jsonify(data), 200


@profile.route("/api/profile", methods=["PUT"])
@role_required(*ANY_ROLE)
def update_profile():
    data = request.get_json(silent=True) or {}
    user_id = get_jwt_identity()

    full_name = (data.get("full_name") or "").strip()
    if not full_name:
        return error("Full name is required")
    if len(full_name) > 100:
        return error("Full name is too long")

    # the farm fields are checked here too, before anything is saved
    farm_name = (data.get("farm_name") or "").strip()
    if len(farm_name) > 150:
        return error("Farm name is too long")
    size = data.get("farm_size_ha")
    try:
        size = float(size) if size not in (None, "") else None
    except (TypeError, ValueError):
        return error("Farm size must be a number")
    if size is not None and not 0 <= size < 10000:
        return error("Farm size is out of range")

    connection = get_connection()
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT role FROM users WHERE id = %s", (user_id,))
        is_farmer = cursor.fetchone()["role"] == "farmer"

        cursor.execute("UPDATE users SET name = %s WHERE id = %s", (full_name, user_id))

        # staff have no farm, so their farm fields are ignored
        if is_farmer:
            # the farmers row keeps the same name as the account
            cursor.execute(
                "UPDATE farmers SET full_name = %s, farm_name = %s, farm_size_ha = %s WHERE user_id = %s",
                (full_name, farm_name, size, user_id),
            )

        connection.commit()
        result = load(cursor, user_id)
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()

    return jsonify(result), 200


@profile.route("/api/profile/password", methods=["POST"])
@role_required(*ANY_ROLE)
def change_password():
    data = request.get_json(silent=True) or {}
    current = data.get("current_password") or ""
    new = data.get("new_password") or ""

    if not current or not new:
        return error("Enter your current password and a new one")
    if len(new) < MIN_PASSWORD:
        return error(f"The new password must be at least {MIN_PASSWORD} characters")

    connection = get_connection()
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT password_hash FROM users WHERE id = %s", (get_jwt_identity(),))
        if not verify_password(current, cursor.fetchone()["password_hash"]):
            return error("Your current password is wrong", 403)
        cursor.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s", (hash_password(new), get_jwt_identity())
        )
        connection.commit()
    finally:
        cursor.close()
        connection.close()

    return jsonify({"message": "Password changed"}), 200
