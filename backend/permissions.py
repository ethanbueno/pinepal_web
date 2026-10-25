from functools import wraps

from flask import jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

from database import get_connection


def get_role(user_id):
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("SELECT role FROM users WHERE id = %s", (user_id,))
    row = cursor.fetchone()
    cursor.close()
    connection.close()
    return row["role"] if row else None


def admin_required(fn):
    """Require a valid JWT whose user currently has the admin role."""

    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        if get_role(get_jwt_identity()) != "admin":
            return jsonify({"message": "Admin access required"}), 403
        return fn(*args, **kwargs)

    return wrapper


def staff_required(fn):
    """Require a valid JWT whose user is an admin or an officer."""

    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        if get_role(get_jwt_identity()) not in ("admin", "officer"):
            return jsonify({"error": "Staff access required"}), 403
        return fn(*args, **kwargs)

    return wrapper


def role_required(*roles):
    """Require a valid JWT whose user has one of the given roles."""

    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            if get_role(get_jwt_identity()) not in roles:
                return jsonify({"error": "You do not have permission to do this"}), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator
