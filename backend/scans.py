import os
import uuid

from flask import Blueprint, jsonify, request, send_from_directory
from flask_jwt_extended import get_jwt_identity, jwt_required

from database import get_connection
from permissions import admin_required
from predict import predict

scans = Blueprint("scans", __name__)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
ALLOWED = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}

COLUMNS = """
    id, user_id, image_url, predicted_class,
    CAST(confidence AS DOUBLE) AS confidence,
    cultivar, lot_reference, timestamp
"""


def serialize(scan):
    scan["timestamp"] = scan["timestamp"].isoformat()
    return scan


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


@scans.route("/api/admin/stats", methods=["GET"])
@admin_required
def admin_stats():
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("SELECT COUNT(*) AS total FROM users WHERE role = 'farmer'")
    total_users = cursor.fetchone()["total"]
    cursor.execute("SELECT COUNT(*) AS total FROM scans")
    total_scans = cursor.fetchone()["total"]
    cursor.execute("SELECT COUNT(*) AS total FROM admin_reviews")
    total_reviews = cursor.fetchone()["total"]
    cursor.close()
    connection.close()

    return jsonify({
        "totalUsers": total_users,
        "totalScans": total_scans,
        "totalReviews": total_reviews,
    }), 200
