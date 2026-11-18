"""Settings admins can change from the web, kept as key/value rows in app_settings.

GET /api/settings/app-download   anyone, no sign-in (the login page uses it).
                                 Returns { url }: the saved link, or DEFAULT_APP_DOWNLOAD_URL.
PUT /api/settings/app-download   admin only. Body { url }, an http(s) link. Returns { url }.

The link is where the Android app (APK) is downloaded from: the login page's Download
button and the sidebar's "Download mobile app" card. Errors are { "error": "message" }.
"""
from urllib.parse import urlparse

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity

from database import get_connection
from permissions import admin_required

app_settings = Blueprint("app_settings", __name__)

APP_DOWNLOAD_KEY = "app_download_url"
# the same link as src/config/app.js, used until an admin saves another one
DEFAULT_APP_DOWNLOAD_URL = (
    "https://drive.google.com/drive/folders/1C0kV6LxyPJJgpBZnmGJDiV6yS7n9ArIf?usp=drive_link"
)
MAX_URL_LENGTH = 500


def read_setting(key, default=None):
    connection = get_connection()
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT setting_value FROM app_settings WHERE setting_key = %s", (key,))
        row = cursor.fetchone()
    finally:
        cursor.close()
        connection.close()
    return row["setting_value"] if row and row["setting_value"] else default


@app_settings.route("/api/settings/app-download", methods=["GET"])
def get_app_download():
    try:
        url = read_setting(APP_DOWNLOAD_KEY, DEFAULT_APP_DOWNLOAD_URL)
    except Exception:
        # no table yet, or the database is down: the login page still gets a working link
        url = DEFAULT_APP_DOWNLOAD_URL
    return jsonify({"url": url})


@app_settings.route("/api/settings/app-download", methods=["PUT"])
@admin_required
def set_app_download():
    url = str((request.get_json(silent=True) or {}).get("url") or "").strip()
    if not url:
        return jsonify({"error": "Enter the download link."}), 400
    if len(url) > MAX_URL_LENGTH:
        return jsonify({"error": f"The link can be at most {MAX_URL_LENGTH} characters."}), 400
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc or " " in url:
        return jsonify({"error": "Enter a full link that starts with https://"}), 400

    connection = get_connection()
    cursor = connection.cursor()
    try:
        cursor.execute(
            "INSERT INTO app_settings (setting_key, setting_value, updated_by) VALUES (%s, %s, %s) "
            "ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)",
            (APP_DOWNLOAD_KEY, url, get_jwt_identity()),
        )
        connection.commit()
    finally:
        cursor.close()
        connection.close()
    return jsonify({"url": url})
