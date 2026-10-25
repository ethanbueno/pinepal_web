"""Scan routes for the web dashboard, backed by the mobile app's scans (mobile_scans table).

Every route is for staff (admin / officer). Errors are { "error": "message" }.
"""
import csv
import io
import uuid
from datetime import datetime

from flask import Blueprint, Response, jsonify, request

from database import get_connection
from permissions import role_required, staff_required

mobile_scans = Blueprint("mobile_scans", __name__)

LABELS = ["No_Disease", "Crown_Rot", "Mealybug_Wilt", "Fruit_Rot", "Multiple_Crown", "Fruit_Fasciation"]
LOW_CONFIDENCE = 0.6  # same as LOW_CONFIDENCE in src/utils/diseases.js
FINAL = "COALESCE(verified_label, predicted_label)"

EXPORT_COLUMNS = [
    "scan_uuid", "scanned_at", "farmer_name", "farm_name", "municipality",
    "latitude", "longitude", "predicted_label", "confidence",
    "verified_label", "image_source",
]


def serialize(row):
    scan = dict(row)
    for key in ("scanned_at", "synced_at", "verified_at"):
        scan[key] = scan[key].isoformat() if scan.get(key) else None
    for key in ("latitude", "longitude", "confidence", "second_confidence"):
        scan[key] = float(scan[key])
    # The mobile data has no farmer names, so show the farmer ID.
    scan["farmer_name"] = scan["farmer_id"]
    # The photos live on the phones; only a path is stored.
    scan["image_url"] = ""
    return scan


def build_filters(args):
    """Turn the query string into a WHERE clause (same filters as src/api/scans.js)."""
    where, params = [], []

    # "final" diagnosis = the verified label when there is one, otherwise the prediction.
    # The dashboard, the map and this filter all use it, so their numbers agree.
    if args.get("disease"):
        where.append(f"{FINAL} = %s")
        params.append(args["disease"])

    diseases = [d for d in (args.get("diseases") or "").split(",") if d]
    if diseases:
        where.append(f"{FINAL} IN ({', '.join(['%s'] * len(diseases))})")
        params += diseases

    if args.get("municipality"):
        where.append("municipality = %s")
        params.append(args["municipality"])

    if args.get("farmer_id"):
        where.append("farmer_id = %s")
        params.append(args["farmer_id"])

    if args.get("verified") == "yes":
        where.append("verified_label IS NOT NULL")
    elif args.get("verified") == "no":
        where.append("verified_label IS NULL")

    if args.get("low_conf") in ("1", "true"):
        where.append("confidence < %s")
        params.append(LOW_CONFIDENCE)

    if args.get("from"):
        where.append("scanned_at >= %s")
        params.append(args["from"] + " 00:00:00")
    if args.get("to"):
        where.append("scanned_at <= %s")
        params.append(args["to"] + " 23:59:59")

    if args.get("search"):
        where.append("(farmer_id LIKE %s OR farm_name LIKE %s)")
        like = f"%{args['search']}%"
        params += [like, like]

    clause = ("WHERE " + " AND ".join(where)) if where else ""
    return clause, params


def query(sql, params=(), one=False):
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute(sql, params)
    result = cursor.fetchone() if one else cursor.fetchall()
    cursor.close()
    connection.close()
    return result


def not_found():
    return jsonify({"error": "Scan not found"}), 404


@mobile_scans.route("/api/scans", methods=["GET"])
@staff_required
def list_scans():
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 20, type=int), 1), 200)
    where, params = build_filters(request.args)

    total = query(f"SELECT COUNT(*) AS n FROM mobile_scans {where}", params, one=True)["n"]
    rows = query(
        f"SELECT * FROM mobile_scans {where} ORDER BY scanned_at DESC, scan_uuid LIMIT %s OFFSET %s",
        params + [per_page, (page - 1) * per_page],
    )
    return jsonify({
        "items": [serialize(r) for r in rows],
        "total": total,
        "page": page,
        "per_page": per_page,
    }), 200


@mobile_scans.route("/api/scans/count", methods=["GET"])
@staff_required
def count_scans():
    where, params = build_filters(request.args)
    total = query(f"SELECT COUNT(*) AS n FROM mobile_scans {where}", params, one=True)["n"]
    return jsonify(total), 200


@mobile_scans.route("/api/scans/map", methods=["GET"])
@staff_required
def map_scans():
    where, params = build_filters(request.args)
    rows = query(
        "SELECT scan_uuid, latitude, longitude, predicted_label, verified_label, "
        f"confidence, scanned_at, farmer_id FROM mobile_scans {where} ORDER BY scanned_at DESC",
        params,
    )
    items = []
    for r in rows:
        r = dict(r)
        items.append({
            "scan_uuid": r["scan_uuid"],
            "latitude": float(r["latitude"]),
            "longitude": float(r["longitude"]),
            "predicted_label": r["predicted_label"],
            "verified_label": r["verified_label"],
            "confidence": float(r["confidence"]),
            "scanned_at": r["scanned_at"].isoformat(),
            "farmer_name": r["farmer_id"],
            "image_url": "",
        })
    return jsonify(items), 200


@mobile_scans.route("/api/scans/export", methods=["GET"])
@staff_required
def export_scans():
    where, params = build_filters(request.args)
    rows = query(f"SELECT * FROM mobile_scans {where} ORDER BY scanned_at DESC", params)

    out = io.StringIO()
    writer = csv.writer(out, quoting=csv.QUOTE_ALL)
    writer.writerow(EXPORT_COLUMNS)
    for r in rows:
        scan = serialize(r)
        writer.writerow([scan.get(c) if scan.get(c) is not None else "" for c in EXPORT_COLUMNS])

    return Response(
        out.getvalue(),
        mimetype="text/csv",
        headers={"X-Row-Count": str(len(rows))},
    )


@mobile_scans.route("/api/scans/<scan_uuid>", methods=["GET"])
@staff_required
def get_scan(scan_uuid):
    row = query("SELECT * FROM mobile_scans WHERE scan_uuid = %s", (scan_uuid,), one=True)
    if not row:
        return not_found()
    return jsonify(serialize(row)), 200


@mobile_scans.route("/api/scans", methods=["POST"])
@staff_required
def create_scan():
    data = request.get_json(silent=True) or {}

    required = [
        "farmer_id", "farm_name", "municipality", "latitude", "longitude",
        "predicted_label", "confidence", "second_label", "second_confidence",
    ]
    missing = [f for f in required if data.get(f) in (None, "")]
    if missing:
        return jsonify({"error": "Missing: " + ", ".join(missing)}), 400
    if data["predicted_label"] not in LABELS or data["second_label"] not in LABELS:
        return jsonify({"error": "Unknown disease label"}), 400

    scan_uuid = str(uuid.uuid4())
    now = datetime.now().replace(microsecond=0)

    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute(
        """
        INSERT INTO mobile_scans
        (scan_uuid, farmer_id, farm_name, municipality, latitude, longitude, scanned_at,
         predicted_label, confidence, second_label, second_confidence,
         image_source, image_path, synced_at, notes)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'Web', '', %s, %s)
        """,
        (
            scan_uuid, data["farmer_id"], data["farm_name"], data["municipality"],
            data["latitude"], data["longitude"], now,
            data["predicted_label"], data["confidence"],
            data["second_label"], data["second_confidence"],
            now, data.get("notes"),
        ),
    )
    connection.commit()
    cursor.close()
    connection.close()

    row = query("SELECT * FROM mobile_scans WHERE scan_uuid = %s", (scan_uuid,), one=True)
    return jsonify(serialize(row)), 201


@mobile_scans.route("/api/scans/<scan_uuid>/verify", methods=["POST"])
@staff_required
def verify_scan(scan_uuid):
    data = request.get_json(silent=True) or {}
    label = data.get("verified_label")
    if label not in LABELS:
        return jsonify({"error": "Unknown disease label"}), 400

    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute(
        "UPDATE mobile_scans SET verified_label = %s, verified_by = %s, verified_at = %s "
        "WHERE scan_uuid = %s",
        (label, data.get("verified_by"), datetime.now().replace(microsecond=0), scan_uuid),
    )
    connection.commit()
    cursor.close()
    connection.close()

    row = query("SELECT * FROM mobile_scans WHERE scan_uuid = %s", (scan_uuid,), one=True)
    if not row:
        return not_found()
    return jsonify(serialize(row)), 200


@mobile_scans.route("/api/scans/<scan_uuid>", methods=["DELETE"])
@role_required("admin")  # the Delete button is admin-only in the web app too
def delete_scan(scan_uuid):
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("DELETE FROM mobile_scans WHERE scan_uuid = %s", (scan_uuid,))
    connection.commit()
    deleted = cursor.rowcount
    cursor.close()
    connection.close()

    if not deleted:
        return not_found()
    return "", 204


@mobile_scans.route("/api/stats", methods=["GET"])
@staff_required
def stats():
    where, params = build_filters({"from": request.args.get("from"), "to": request.args.get("to")})
    latest = query(
        f"SELECT DATE_FORMAT(MAX(scanned_at), '%%Y-%%m') AS month FROM mobile_scans {where}",
        params,
        one=True,
    )["month"]

    totals = query(
        f"""
        SELECT COUNT(*) AS total,
               COALESCE(SUM({FINAL} <> 'No_Disease'), 0) AS diseased,
               COALESCE(SUM(verified_label IS NULL AND confidence < %s), 0) AS needs_review,
               COALESCE(SUM(DATE_FORMAT(scanned_at, '%%Y-%%m') = %s), 0) AS this_month
        FROM mobile_scans {where}
        """,
        [LOW_CONFIDENCE, latest] + params,
        one=True,
    )
    total = int(totals["total"])

    counts = {r["label"]: r["n"] for r in query(
        f"SELECT {FINAL} AS label, COUNT(*) AS n FROM mobile_scans {where} GROUP BY label", params)}
    by_disease = [{"label": label, "count": int(counts.get(label, 0))} for label in LABELS]

    months = {}
    for r in query(
        f"SELECT DATE_FORMAT(scanned_at, '%%Y-%%m') AS month, {FINAL} AS label, COUNT(*) AS n "
        f"FROM mobile_scans {where} GROUP BY month, label ORDER BY month",
        params,
    ):
        row = months.setdefault(r["month"], {"month": r["month"], **{label: 0 for label in LABELS}})
        row[r["label"]] = int(r["n"])

    by_municipality = [
        {"municipality": r["municipality"], "diseased": int(r["diseased"]), "total": int(r["total"])}
        for r in query(
            f"SELECT municipality, SUM({FINAL} <> 'No_Disease') AS diseased, COUNT(*) AS total "
            f"FROM mobile_scans {where} GROUP BY municipality ORDER BY diseased DESC, total DESC",
            params,
        )
    ]

    recent = query(f"SELECT * FROM mobile_scans {where} ORDER BY scanned_at DESC LIMIT 8", params)

    return jsonify({
        "total_scans": total,
        "scans_this_month": int(totals["this_month"]),
        "latest_month": latest,  # YYYY-MM of the newest scan in the range (None when empty)
        "diseased_pct": (int(totals["diseased"]) / total) if total else 0,
        "needs_review": int(totals["needs_review"]),
        "by_disease": by_disease,
        "by_month": list(months.values()),
        "by_municipality": by_municipality,
        "recent": [serialize(r) for r in recent],
    }), 200
