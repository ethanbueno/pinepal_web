"""The signed-in user's own profile, for the web Profile page and the mobile app.

GET  /api/profile           the account, and for a farmer their farm, straight from the database
PUT  /api/profile           Edit profile. Only the fields sent are changed; the rest stay as they are.
                              everyone:      full_name, username, email, new_password
                              farmers also:  farm_name, farm_size_ha
                            Changing the username, email or password needs current_password.
                            Anything else in the body is ignored, so role, farmer ID,
                            municipality, farm location and account status can only be
                            changed by an admin or officer.
POST /api/profile/password  change only the password (the mobile app); current_password first

Every role can use these, but only for their own account. A phone's device token has no
account, so it gets 403. Errors are { "error": "message" }.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity

from database import get_connection
from farmers import MIN_PASSWORD, SELECT, USERNAME, serialize as farm_json
from permissions import role_required
from security import hash_password, verify_password
from web_auth import EMAIL_PATTERN

profile = Blueprint("profile", __name__)

ANY_ROLE = ("admin", "officer", "farmer")


def error(message, status=400):
    return jsonify({"error": message}), status


def load(cursor, user_id):
    """The profile as the API sends it: { account, farm } (farm is null for staff)."""
    cursor.execute(
        "SELECT id, name, username, email, role, municipality, created_at FROM users WHERE id = %s", (user_id,)
    )
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
            "municipality": user["municipality"],  # same as the farm's for a farmer
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

    # Check every field that was sent before anything is saved. A field that was not sent
    # is not touched.
    account = {}  # users columns to change
    farm = {}  # farmers columns to change (farmers only)

    if "full_name" in data:
        full_name = (data.get("full_name") or "").strip()
        if not full_name:
            return error("Full name is required")
        if len(full_name) > 100:
            return error("Full name is too long")
        account["name"] = full_name

    if "username" in data:
        username = (data.get("username") or "").strip()
        if not USERNAME.fullmatch(username):
            return error("Username must be 3 to 50 letters, numbers, dots, dashes or underscores")
        account["username"] = username

    if "email" in data:
        email = (data.get("email") or "").strip()
        if len(email) > 150 or not EMAIL_PATTERN.match(email):
            return error("Enter a valid email address")
        account["email"] = email

    new_password = data.get("new_password") or ""
    if new_password:
        if len(new_password) < MIN_PASSWORD:
            return error(f"The new password must be at least {MIN_PASSWORD} characters")

    if "farm_name" in data:
        farm_name = (data.get("farm_name") or "").strip()
        if len(farm_name) > 150:
            return error("Farm name is too long")
        farm["farm_name"] = farm_name

    if "farm_size_ha" in data:
        size = data.get("farm_size_ha")
        try:
            size = float(size) if size not in (None, "") else None  # empty clears it
        except (TypeError, ValueError):
            return error("Farm size must be a number")
        if size is not None and not 0 <= size < 10000:
            return error("Farm size is out of range")
        farm["farm_size_ha"] = size

    connection = get_connection()
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT role, username, email, password_hash FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        is_farmer = user["role"] == "farmer"

        # a username or email sent unchanged is not a change, so it doesn't ask for the password
        for column in ("username", "email"):
            if account.get(column) == user[column]:
                del account[column]

        # signing-in details need the current password, so an unlocked screen can't take them over
        if new_password or "username" in account or "email" in account:
            if not verify_password(data.get("current_password") or "", user["password_hash"]):
                return error("Your current password is wrong", 403)
        if new_password:
            account["password_hash"] = hash_password(new_password)

        if "username" in account:
            cursor.execute("SELECT 1 FROM users WHERE username = %s AND id <> %s", (account["username"], user_id))
            if cursor.fetchone():
                return error("That username is already taken", 409)
        if "email" in account:
            cursor.execute("SELECT 1 FROM users WHERE email = %s AND id <> %s", (account["email"], user_id))
            if cursor.fetchone():
                return error("That email is already in use", 409)

        if account:
            cursor.execute(
                "UPDATE users SET " + ", ".join(f"{column} = %s" for column in account) + " WHERE id = %s",
                (*account.values(), user_id),
            )

        # staff have no farm, so their farm fields are ignored. The farmers row keeps the
        # same name as the account.
        if is_farmer:
            if "name" in account:
                farm["full_name"] = account["name"]
            if farm:
                cursor.execute(
                    "UPDATE farmers SET " + ", ".join(f"{column} = %s" for column in farm) + " WHERE user_id = %s",
                    (*farm.values(), user_id),
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
