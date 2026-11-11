"""Login history: every sign-in attempt on the web and the mobile app, for admins.

record_login(...)          called by POST /api/auth/login (web) and POST /api/mobile/login
                           (mobile) after each attempt, successful or not. It never makes a
                           login fail: if the history can't be saved, the login goes on.
GET /api/login-history     admin only. Newest first, a page at a time.
                           Filters: search (username or name), result (success | failed),
                           platform (web | mobile). Returns { items, total, page, per_page }.

Passwords are never stored, only the username or email that was typed.
Errors are { "error": "message" }.
"""
import logging

from flask import Blueprint, jsonify, request

from database import get_connection
from permissions import admin_required

login_history = Blueprint("login_history", __name__)
log = logging.getLogger(__name__)

PLATFORMS = ("web", "mobile")
MAX_PER_PAGE = 100

# Why an attempt failed, as saved in login_history.reason
WRONG_PASSWORD = "wrong_password"
UNKNOWN_USER = "unknown_user"
DEACTIVATED = "deactivated"


def client_ip():
    """The visitor's address. Behind a proxy (a hosted server) it is in X-Forwarded-For."""
    forwarded = request.headers.get("X-Forwarded-For", "")
    return (forwarded.split(",")[0].strip() or request.remote_addr or "")[:45]


def record_login(platform, username, user=None, success=False, reason=None):
    """Save one sign-in attempt. user is the users row when the username matched one."""
    try:
        connection = get_connection()
        cursor = connection.cursor()
        try:
            cursor.execute(
                "INSERT INTO login_history (user_id, username, success, reason, platform, ip_address, user_agent) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (
                    user["id"] if user else None,
                    username[:150],
                    int(success),
                    reason,
                    platform,
                    client_ip(),
                    (request.headers.get("User-Agent") or "")[:255],
                ),
            )
            connection.commit()
        finally:
            cursor.close()
            connection.close()
    except Exception:  # the history is a record, not part of signing in
        log.exception("Could not save the login history")


@login_history.route("/api/login-history", methods=["GET"])
@admin_required
def list_login_history():
    try:
        page = max(1, int(request.args.get("page", 1)))
        per_page = min(MAX_PER_PAGE, max(1, int(request.args.get("per_page", 25))))
    except ValueError:
        return jsonify({"error": "page and per_page must be numbers"}), 400

    where, params = [], []
    search = (request.args.get("search") or "").strip()
    if search:
        where.append("(h.username LIKE %s OR u.username LIKE %s OR u.name LIKE %s)")
        like = f"%{search}%"
        params += [like, like, like]
    if request.args.get("result") == "success":
        where.append("h.success = 1")
    elif request.args.get("result") == "failed":
        where.append("h.success = 0")
    if request.args.get("platform") in PLATFORMS:
        where.append("h.platform = %s")
        params.append(request.args["platform"])
    clause = ("WHERE " + " AND ".join(where)) if where else ""

    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute(
        f"SELECT COUNT(*) AS n FROM login_history h LEFT JOIN users u ON u.id = h.user_id {clause}", params
    )
    total = int(cursor.fetchone()["n"])
    cursor.execute(
        f"""
        SELECT h.id, h.username, h.success, h.reason, h.platform, h.ip_address, h.user_agent, h.created_at,
               u.id AS user_id, u.name AS full_name, u.role
        FROM login_history h
        LEFT JOIN users u ON u.id = h.user_id
        {clause}
        ORDER BY h.created_at DESC, h.id DESC
        LIMIT %s OFFSET %s
        """,
        params + [per_page, (page - 1) * per_page],
    )
    rows = cursor.fetchall()
    cursor.close()
    connection.close()

    return jsonify({
        "items": [
            {
                "id": r["id"],
                "username": r["username"],  # what was typed: a username or an email
                "user_id": r["user_id"],  # null when no account matched (or it was deleted)
                "full_name": r["full_name"],
                "role": r["role"],
                "success": bool(r["success"]),
                "reason": r["reason"],
                "platform": r["platform"],
                "ip_address": r["ip_address"],
                "user_agent": r["user_agent"],
                "created_at": r["created_at"].isoformat(),
            }
            for r in rows
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }), 200
