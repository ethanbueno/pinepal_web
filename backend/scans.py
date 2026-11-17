import os

from flask import Blueprint, jsonify, send_from_directory
from flask_jwt_extended import jwt_required

from database import get_connection

# Scan photos and the disease library. The scans themselves are in mobile_scans
# (mobile_scans.py, mobile_sync.py).
scans = Blueprint("scans", __name__)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")


@scans.route("/uploads/<path:filename>")
def uploaded_file(filename):
    # Filenames are random UUIDs, so <img> tags can load them without a token.
    return send_from_directory(UPLOAD_DIR, filename)


@scans.route("/api/diseases", methods=["GET"])
@jwt_required()
def list_diseases():
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("SELECT * FROM diseases ORDER BY name ASC")
    rows = cursor.fetchall()
    cursor.close()
    connection.close()
    return jsonify(rows), 200
