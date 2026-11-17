"""Forgot password: a 6-digit code sent to the account's email, for the web and the mobile app.

POST /api/auth/forgot-password   { "email" }
    If an account uses that email, emails it a code. Always answers the same
    ("If an account uses this email, we sent a code"), so the form can't be used to find
    out which emails are registered.
POST /api/auth/reset-password    { "email", "code", "new_password" }
    Checks the code and sets the new password (the same rules as sign up, security.py).

The codes (table password_resets, migrate_password_resets.py):
  - are hashed with bcrypt like passwords, so the database never holds a usable code
  - work once and expire after CODE_MINUTES
  - allow MAX_ATTEMPTS wrong tries, then the code stops working
  - a new code, or a successful reset, cancels every older one
  - at most MAX_PER_HOUR codes per account an hour, at least COOLDOWN_SECONDS apart, so the
    form can't flood someone's inbox (over the limit it still answers the same, without sending)
Deactivated farmers get no code (they couldn't sign in anyway). Accounts without an email
can't use this: an admin resets them from the Users page.

Both requests show on the Audit logs page as activity, under the account they were for, and
the password change itself as a change to that account.

Email goes out through Gmail (mailer.py). Without MAIL_* in .env, a debug run (python app.py)
prints the code in the terminal instead, for testing; a deployed server says email is not set up.
Errors are { "error": "message" }.
"""
import logging
import re
import secrets

from flask import Blueprint, current_app, g, jsonify, request

import mailer
from database import audit_context, get_connection
from security import hash_password, password_problem, set_password, verify_password
from web_auth import EMAIL_PATTERN, is_deactivated

password_reset = Blueprint("password_reset", __name__)
log = logging.getLogger(__name__)

CODE_MINUTES = 15
MAX_ATTEMPTS = 5
MAX_PER_HOUR = 3
COOLDOWN_SECONDS = 60
CODE = re.compile(r"^\d{6}$")

SENT = "If an account uses this email, we sent it a 6-digit code. It works for 15 minutes."
WRONG_CODE = "That code is wrong or has expired. Check the email, or request a new code."


def error(message, status=400):
    return jsonify({"error": message}), status


def find_account(email):
    """The users row with this email (any letter case), or None."""
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("SELECT id, name, username, email, role FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()
    blocked = bool(user) and is_deactivated(cursor, user)
    cursor.close()
    connection.close()
    return user, blocked


def act_as(user_id):
    """Record what follows in the audit logs under this account (no one is signed in)."""
    _, label, ip, request_id = audit_context()
    g.audit_context = (user_id, label, ip, request_id)


def code_email(user, code):
    name = user["name"].split(" ")[0] if user["name"] else user["username"]
    text = (
        f"Hi {name},\n\n"
        f"Your PinePal password reset code is: {code}\n\n"
        f"It works for {CODE_MINUTES} minutes. Enter it on the Forgot password screen with your new password.\n\n"
        "If you didn't ask to reset your password, ignore this email. Your password stays the same.\n\n"
        "PinePal"
    )
    html = f"""\
<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1f2937">
  <h2 style="margin-bottom:4px">Reset your PinePal password</h2>
  <p>Hi {name},</p>
  <p>Your password reset code is:</p>
  <p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:16px 0">{code}</p>
  <p>It works for {CODE_MINUTES} minutes. Enter it on the <b>Forgot password</b> screen with your new password.</p>
  <p style="color:#6b7280;font-size:13px">If you didn't ask to reset your password, ignore this email.
  Your password stays the same.</p>
</div>"""
    return text, html


@password_reset.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    email = ((request.get_json(silent=True) or {}).get("email") or "").strip()
    if len(email) > 150 or not EMAIL_PATTERN.match(email):
        return error("Enter a valid email address")

    mail_ready = mailer.is_configured()
    if not mail_ready and not current_app.debug:
        return error("Password reset by email isn't set up yet. Ask an admin to reset your password.", 503)

    user, blocked = find_account(email)
    if not user or blocked:
        return jsonify({"message": SENT}), 200
    act_as(user["id"])

    connection = get_connection()
    cursor = connection.cursor()
    try:
        cursor.execute(
            "SELECT COUNT(*) AS n, COALESCE(MAX(created_at) > NOW() - INTERVAL %s SECOND, 0) AS too_soon "
            "FROM password_resets WHERE user_id = %s AND created_at > NOW() - INTERVAL 1 HOUR",
            (COOLDOWN_SECONDS, user["id"]),
        )
        recent = cursor.fetchone()
        if recent["n"] >= MAX_PER_HOUR or recent["too_soon"]:
            return jsonify({"message": SENT}), 200  # same answer, nothing sent

        code = f"{secrets.randbelow(1_000_000):06d}"
        # only the newest code works
        cursor.execute("UPDATE password_resets SET used_at = NOW() WHERE user_id = %s AND used_at IS NULL", (user["id"],))
        cursor.execute(
            "INSERT INTO password_resets (user_id, code_hash, expires_at) "
            "VALUES (%s, %s, NOW() + INTERVAL %s MINUTE)",
            (user["id"], hash_password(code), CODE_MINUTES),
        )
        connection.commit()
    finally:
        cursor.close()
        connection.close()

    if mail_ready:
        text, html = code_email(user, code)
        if not mailer.send_email(user["email"], "Your PinePal password reset code", text, html):
            log.error("The reset code for user %s was not emailed", user["id"])
    else:
        # local testing only (debug run without Gmail set up)
        print(f"* [no email set up] Password reset code for {user['email']}: {code}", flush=True)
    return jsonify({"message": SENT}), 200


@password_reset.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    code = (data.get("code") or "").strip()
    new_password = data.get("new_password") or ""

    if not EMAIL_PATTERN.match(email) or not CODE.match(code):
        return error("Enter your email and the 6-digit code from it")
    problem = password_problem(new_password)
    if problem:  # checked first, so a weak password doesn't use up a try
        return error(problem)

    user, blocked = find_account(email)
    if not user or blocked:
        return error(WRONG_CODE)
    act_as(user["id"])

    connection = get_connection()
    cursor = connection.cursor()
    try:
        cursor.execute(
            "SELECT id, code_hash, attempts FROM password_resets "
            "WHERE user_id = %s AND used_at IS NULL AND expires_at > NOW() "
            "ORDER BY id DESC LIMIT 1 FOR UPDATE",
            (user["id"],),
        )
        reset = cursor.fetchone()
        if not reset:
            return error(WRONG_CODE)

        if not verify_password(code, reset["code_hash"]):
            attempts = reset["attempts"] + 1
            left = MAX_ATTEMPTS - attempts
            if left <= 0:
                cursor.execute("UPDATE password_resets SET attempts = %s, used_at = NOW() WHERE id = %s",
                               (attempts, reset["id"]))
                connection.commit()
                return error("Too many wrong codes. Request a new code.")
            cursor.execute("UPDATE password_resets SET attempts = %s WHERE id = %s", (attempts, reset["id"]))
            connection.commit()
            return error(f"That code is wrong. {left} {'try' if left == 1 else 'tries'} left.")

        set_password(cursor, user["id"], new_password)
        # this code and any other open one are done
        cursor.execute("UPDATE password_resets SET used_at = NOW() WHERE user_id = %s AND used_at IS NULL", (user["id"],))
        connection.commit()
    finally:
        cursor.close()
        connection.close()
    return jsonify({"message": "Your password was changed. Sign in with the new one."}), 200
