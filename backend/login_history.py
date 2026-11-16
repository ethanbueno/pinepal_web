"""Login history: every sign-in attempt on the web and the mobile app.

record_login(...)   called by POST /api/auth/login (web) and POST /api/mobile/login (mobile)
                    after each attempt, successful or not. It never makes a login fail: if
                    the history can't be saved, the login goes on.
record_logout(...)  called by POST /api/auth/logout. Sign-outs go straight into audit_logs.

A database trigger copies each new row into audit_logs (category 'login'), and admins see
it on the Audit logs page (audit_logs.py, migrate_audit_logs.py).

Passwords are never stored, only the username or email that was typed.
"""
import logging

from flask import g, request

from database import audit_context, get_connection

log = logging.getLogger(__name__)

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
            g.login_recorded = True  # activity_log.py: this row stands for the request
        finally:
            cursor.close()
            connection.close()
    except Exception:  # the history is a record, not part of signing in
        log.exception("Could not save the login history")


def record_logout(platform):
    """Save a sign-out in audit_logs (category 'login', action LOGOUT) for the signed-in user.

    Signing out only forgets the token on the device, so this is the server's one chance to
    hear about it. Returns False when no one is signed in (an expired token): nothing to save.
    """
    user_id, label, ip, request_id = audit_context()
    if user_id is None and label is None:
        return False
    try:
        connection = get_connection()
        cursor = connection.cursor()
        try:
            cursor.execute(
                "INSERT INTO audit_logs (category, action, actor_id, actor_label, ip_address, request_id, "
                "platform, user_agent) VALUES ('login', 'LOGOUT', %s, %s, %s, %s, %s, %s)",
                (user_id, label, ip, request_id, platform, (request.headers.get("User-Agent") or "")[:255]),
            )
            connection.commit()
            g.login_recorded = True  # activity_log.py: this row stands for the request
        finally:
            cursor.close()
            connection.close()
    except Exception:
        log.exception("Could not save the sign-out")
    return True
