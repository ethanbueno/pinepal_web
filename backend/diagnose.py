from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from classifier import analyze, thresholds
from permissions import get_role

diagnose = Blueprint("diagnose", __name__)

ALLOWED_TYPES = ("image/jpeg", "image/png")


@diagnose.route("/api/diagnose", methods=["POST"])
@jwt_required()
def diagnose_image():
    # staff check photos for any farmer, farmers check their own
    if get_role(get_jwt_identity()) not in ("admin", "officer", "farmer"):
        return jsonify({"error": "Not allowed"}), 403

    image = request.files.get("image")
    if not image:
        return jsonify({"error": "No image uploaded"}), 400

    if image.mimetype not in ALLOWED_TYPES:
        return jsonify({"error": "File must be JPG or PNG"}), 415

    try:
        result = analyze(image.stream)
        _, disease_threshold = thresholds()
    except Exception as error:  # unreadable or broken image
        print("diagnose failed:", error)
        return jsonify({"error": "Could not read that image"}), 400

    if not result["is_pineapple"]:
        # Not a pineapple: no diagnosis, and the page must not offer to save it
        return jsonify({
            "is_pineapple": False,
            "pineapple_score": result["pineapple_score"],
            "predictions": [],
            "low_confidence": False,
            "uncertain": False,
            "protocol": None,
        }), 200

    predictions = result["predictions"]
    uncertain = predictions[0]["confidence"] < disease_threshold
    return jsonify({
        "is_pineapple": True,
        "pineapple_score": result["pineapple_score"],
        "predictions": predictions,
        "uncertain": uncertain,
        "low_confidence": uncertain,  # older name, kept for anything that still reads it
        # remediation guides come from the protocols table (not built yet)
        "protocol": None,
    }), 200
