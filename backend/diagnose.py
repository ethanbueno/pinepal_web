from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from classifier import classify
from permissions import get_role

diagnose = Blueprint("diagnose", __name__)

LOW_CONFIDENCE = 0.6
ALLOWED_TYPES = ("image/jpeg", "image/png")


@diagnose.route("/api/diagnose", methods=["POST"])
@jwt_required()
def diagnose_image():
    # the web scanner is for admins and officers
    if get_role(get_jwt_identity()) not in ("admin", "officer"):
        return jsonify({"error": "Not allowed"}), 403

    image = request.files.get("image")
    if not image:
        return jsonify({"error": "No image uploaded"}), 400

    if image.mimetype not in ALLOWED_TYPES:
        return jsonify({"error": "File must be JPG or PNG"}), 415

    try:
        predictions = classify(image.stream)
    except Exception as error:  # unreadable or broken image
        print("diagnose failed:", error)
        return jsonify({"error": "Could not read that image"}), 400

    return jsonify({
        "predictions": predictions,
        "low_confidence": predictions[0]["confidence"] < LOW_CONFIDENCE,
        # remediation guides come from the protocols table (not built yet)
        "protocol": None,
    }), 200
