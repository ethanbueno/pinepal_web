"""The admin's Back up button (web Settings > Backup).

GET /api/admin/backup   admin only. Builds the same encrypted backup zip as backup.py (the
                        whole database and the scan photos kept on this server) and sends it
                        straight to the browser as a download. Nothing is saved on the server:
                        Render's disk is wiped on every restart, so a copy there would be lost.
                        Refused when DATA_ENCRYPTION_KEY is not set, so an unencrypted copy of
                        the database never leaves the server. Recorded in the audit logs.

Restoring stays a script (restore.py), run by hand. Errors are { "error": "message" }.
"""
import io
import logging
import os

from flask import Blueprint, jsonify, send_file
from flask_jwt_extended import get_jwt_identity

from backup import make_backup
from database import get_connection
from encryption import cipher
from permissions import admin_required

admin_backup = Blueprint("admin_backup", __name__)
log = logging.getLogger(__name__)


def record(user_id, summary):
    """A BACKUP row in audit_logs, by the admin who downloaded it."""
    try:
        connection = get_connection()
        cursor = connection.cursor()
        cursor.execute(
            "INSERT INTO audit_logs (category, action, actor_id, summary, platform) "
            "VALUES ('activity', 'BACKUP', %s, %s, 'web')",
            (user_id, summary[:255]),
        )
        connection.commit()
        cursor.close()
        connection.close()
    except Exception:  # the download still counts
        log.exception("Could not record the backup in the audit logs")


@admin_backup.route("/api/admin/backup", methods=["GET"])
@admin_required
def download_backup():
    # the app's own login (create_app_user.py) can't read every table or the triggers, so a
    # backup made with it would quietly miss things: it needs the admin login on this server
    if os.getenv("DB_USER") == "pinepal_app" and not os.getenv("DB_ADMIN_USER"):
        return jsonify({"error": "Backups need the database admin login: set DB_ADMIN_USER and DB_ADMIN_PASSWORD on this server."}), 500
    if cipher() is None:
        return jsonify({"error": "Backups are encrypted with DATA_ENCRYPTION_KEY, which is not set on this server."}), 500
    try:
        data, filename, summary, _ = make_backup()
    except Exception:
        log.exception("Backup failed")
        return jsonify({"error": "Could not make the backup. Try again, or run backup.py."}), 500

    record(get_jwt_identity(), "Downloaded from the web: " + summary)
    return send_file(
        io.BytesIO(data),
        mimetype="application/zip",
        as_attachment=True,
        download_name=filename,
        max_age=0,
    )
