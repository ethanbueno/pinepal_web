"""Scan routes for the web dashboard, backed by the mobile app's scans (mobile_scans table).

Every route is for staff (admin / officer), except that a farmer can list, count and open
their own scans. Errors are { "error": "message" }.
"""
import csv
import io
import uuid
from datetime import datetime

from flask import Blueprint, Response, jsonify, request
from flask_jwt_extended import get_jwt_identity

from database import get_connection
from echague_area import OUTSIDE_ECHAGUE, in_echague
from permissions import farmer_scope, role_required, staff_required
from photo_storage import delete_scan_photo, photo_url

ANY_ROLE = ("admin", "officer", "farmer")

mobile_scans = Blueprint("mobile_scans", __name__)

LABELS = ["No_Disease", "Crown_Rot", "Mealybug_Wilt", "Fruit_Rot", "Multiple_Crown", "Fruit_Fasciation"]
LOW_CONFIDENCE = 0.6  # same as LOW_CONFIDENCE in src/utils/diseases.js
HIGH_CONFIDENCE = 0.9  # same as HIGH_CONFIDENCE in src/utils/diseases.js
DASHBOARD_SCANS = 5  # scans per list (highest / lowest) on the web Dashboard (src/pages/Dashboard.jsx)
FINAL = "COALESCE(verified_label, predicted_label)"

EXPORT_COLUMNS = [
    "scan_uuid", "scanned_at", "farmer_name", "farm_name", "municipality",
    "latitude", "longitude", "predicted_label", "confidence",
    "verified_label", "image_source",
]


def shown_farmer(row):
    """Who a scan belongs to, as the tables show it: the farmer ID, or for a scan staff saved
    without choosing a farmer, the staff member's name."""
    if row.get("farmer_id"):
        return row["farmer_id"]
    return f"{row.get('saved_by_name') or 'Staff'} (staff)"


def serialize(row):
    scan = dict(row)
    for key in ("scanned_at", "synced_at", "verified_at"):
        scan[key] = scan[key].isoformat() if scan.get(key) else None
    for key in ("latitude", "longitude", "confidence", "second_confidence"):
        # second_confidence is empty when the phone sent no second guess
        if scan.get(key) is not None:
            scan[key] = float(scan[key])
    # The mobile data has no farmer names, so show the farmer ID.
    scan["farmer_name"] = shown_farmer(scan)
    # Scans synced after the mobile update have their photo on Cloudinary (a full URL) or in
    # uploads/ (photo_storage.py). Older rows hold a path on the phone, which the server does
    # not have, so those stay without an image.
    scan["image_url"] = photo_url(scan.get("image_path"), request.host_url)
    return scan


def visible_filters():
    """The query string's filters, limited to the farmer's own scans when a farmer asks."""
    args = request.args.copy()
    own = farmer_scope(get_jwt_identity())
    if own is not None:
        args["farmer_id"] = own
    return build_filters(args)


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

    # present but empty still filters: a farmer without a farm sees no scans, not all of them
    if "farmer_id" in args:
        where.append("farmer_id = %s")
        params.append(args["farmer_id"])

    if args.get("verified") == "yes":
        where.append("verified_label IS NOT NULL")
    elif args.get("verified") == "no":
        where.append("verified_label IS NULL")

    if args.get("low_conf") in ("1", "true"):
        where.append("confidence < %s")
        params.append(LOW_CONFIDENCE)

    if args.get("high_conf") in ("1", "true"):
        where.append("confidence >= %s")
        params.append(HIGH_CONFIDENCE)

    # between the two: not low, not high (60% up to under 90%)
    if args.get("mid_conf") in ("1", "true"):
        where.append("confidence >= %s AND confidence < %s")
        params += [LOW_CONFIDENCE, HIGH_CONFIDENCE]

    if args.get("from"):
        where.append("scanned_at >= %s")
        params.append(args["from"] + " 00:00:00")
    if args.get("to"):
        where.append("scanned_at <= %s")
        params.append(args["to"] + " 23:59:59")

    # the farmer ID, the farm, or for scans staff saved, the staff member's name or username
    # (the Farmer column shows "Name (staff)" for those)
    if args.get("search"):
        where.append(
            "(farmer_id LIKE %s OR farm_name LIKE %s OR saved_by_name LIKE %s"
            " OR saved_by IN (SELECT id FROM users WHERE name LIKE %s OR username LIKE %s))"
        )
        like = f"%{args['search']}%"
        params += [like] * 5

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
@role_required(*ANY_ROLE)
def list_scans():
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 20, type=int), 1), 200)
    where, params = visible_filters()

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
@role_required(*ANY_ROLE)
def count_scans():
    where, params = visible_filters()
    total = query(f"SELECT COUNT(*) AS n FROM mobile_scans {where}", params, one=True)["n"]
    return jsonify(total), 200


@mobile_scans.route("/api/scans/map", methods=["GET"])
@staff_required
def map_scans():
    where, params = build_filters(request.args)
    rows = query(
        "SELECT scan_uuid, latitude, longitude, predicted_label, verified_label, saved_by_name, "
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
            "farmer_name": shown_farmer(r),
            "image_url": "",
        })
    return jsonify(items), 200


XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
XLSX_WIDTHS = {"scan_uuid": 38, "scanned_at": 20, "farm_name": 22, "municipality": 16,
               "predicted_label": 18, "verified_label": 18}


def export_xlsx(rows):
    """The same columns as the CSV, as an Excel workbook: real dates and numbers, a bold
    header that stays in view, and a filter on every column."""
    from openpyxl import Workbook
    from openpyxl.styles import Font

    book = Workbook()
    sheet = book.active
    sheet.title = "Scans"
    sheet.append(EXPORT_COLUMNS)
    for cell in sheet[1]:
        cell.font = Font(bold=True)

    for r in rows:
        row = dict(r)
        values = []
        for column in EXPORT_COLUMNS:
            value = shown_farmer(row) if column == "farmer_name" else row.get(column)
            if column in ("latitude", "longitude", "confidence") and value is not None:
                value = float(value)  # MySQL decimals, as numbers Excel can sort and sum
            values.append(value)
        sheet.append(values)

    for index, column in enumerate(EXPORT_COLUMNS, start=1):
        letter = sheet.cell(row=1, column=index).column_letter
        sheet.column_dimensions[letter].width = XLSX_WIDTHS.get(column, 14)
        if column == "scanned_at":
            for (cell,) in sheet.iter_rows(min_row=2, min_col=index, max_col=index):
                cell.number_format = "yyyy-mm-dd hh:mm"
        if column == "confidence":
            for (cell,) in sheet.iter_rows(min_row=2, min_col=index, max_col=index):
                cell.number_format = "0.00%"
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions

    out = io.BytesIO()
    book.save(out)
    return out.getvalue()


@mobile_scans.route("/api/scans/export", methods=["GET"])
@staff_required
def export_scans():
    """The filtered scans as a file: format=csv (default) or format=xlsx."""
    where, params = build_filters(request.args)
    rows = query(f"SELECT * FROM mobile_scans {where} ORDER BY scanned_at DESC", params)
    headers = {"X-Row-Count": str(len(rows))}

    if request.args.get("format") == "xlsx":
        return Response(export_xlsx(rows), mimetype=XLSX_TYPE, headers=headers)

    out = io.StringIO()
    writer = csv.writer(out, quoting=csv.QUOTE_ALL)
    writer.writerow(EXPORT_COLUMNS)
    for r in rows:
        scan = serialize(r)
        writer.writerow([scan.get(c) if scan.get(c) is not None else "" for c in EXPORT_COLUMNS])

    return Response(out.getvalue(), mimetype="text/csv", headers=headers)


@mobile_scans.route("/api/scans/<scan_uuid>", methods=["GET"])
@role_required(*ANY_ROLE)
def get_scan(scan_uuid):
    row = query("SELECT * FROM mobile_scans WHERE scan_uuid = %s", (scan_uuid,), one=True)
    own = farmer_scope(get_jwt_identity())
    # another farmer's scan looks the same as a missing one
    if not row or (own is not None and row["farmer_id"] != own):
        return not_found()
    return jsonify(serialize(row)), 200


@mobile_scans.route("/api/scans", methods=["POST"])
@staff_required
def create_scan():
    data = request.get_json(silent=True) or {}

    # No farmer chosen: the scan is saved under the staff member who saved it
    farmer_id = (data.get("farmer_id") or "").strip() or None
    required = ["latitude", "longitude", "predicted_label", "confidence", "second_label", "second_confidence"]
    missing = [f for f in required if data.get(f) in (None, "")]
    if missing:
        return jsonify({"error": "Missing: " + ", ".join(missing)}), 400
    if data["predicted_label"] not in LABELS or data["second_label"] not in LABELS:
        return jsonify({"error": "Unknown disease label"}), 400
    if not in_echague(data["latitude"], data["longitude"]):
        return jsonify({"error": OUTSIDE_ECHAGUE}), 400

    scan_uuid = str(uuid.uuid4())
    now = datetime.now().replace(microsecond=0)

    connection = get_connection()
    cursor = connection.cursor()
    if farmer_id:
        cursor.execute("SELECT 1 FROM farmers WHERE farmer_id = %s", (farmer_id,))
        if not cursor.fetchone():
            cursor.close()
            connection.close()
            return jsonify({"error": "Unknown farmer"}), 400
    cursor.execute("SELECT id, name FROM users WHERE id = %s", (get_jwt_identity(),))
    staff = cursor.fetchone()

    cursor.execute(
        """
        INSERT INTO mobile_scans
        (scan_uuid, farmer_id, saved_by, saved_by_name, farm_name, municipality, latitude, longitude,
         scanned_at, predicted_label, confidence, second_label, second_confidence,
         image_source, image_path, synced_at, notes)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'Web', '', %s, %s)
        """,
        (
            scan_uuid, farmer_id, staff["id"], staff["name"],
            (data.get("farm_name") or "").strip() or None,
            (data.get("municipality") or "").strip() or LOCKED_MUNICIPALITY,
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
    cursor.execute("SELECT image_path FROM mobile_scans WHERE scan_uuid = %s", (scan_uuid,))
    row = cursor.fetchone()
    cursor.execute("DELETE FROM mobile_scans WHERE scan_uuid = %s", (scan_uuid,))
    connection.commit()
    deleted = cursor.rowcount
    cursor.close()
    connection.close()

    if not deleted:
        return not_found()
    if row:
        delete_scan_photo(row["image_path"])  # best effort, after the row is gone
    return "", 204


@mobile_scans.route("/api/stats", methods=["GET"])
@staff_required
def stats():
    where, params = build_filters({"from": request.args.get("from"), "to": request.args.get("to")})

    # The totals come from scan_daily_stats, the aggregate table (migrate_optimization.py):
    # scans per day, municipality and diagnosis, kept up to date by triggers on mobile_scans.
    # So the dashboard adds up a few small rows instead of counting every scan. The same date
    # filter works on it, because it is kept per day. "Needs review" depends on each scan's
    # confidence, which the totals don't keep, so it is counted from mobile_scans in the same
    # query. A second query gets the highest and lowest confidence scans. Each query to a hosted
    # database is a round trip over the internet, so two on one connection load fast.
    day_where, day_params = [], []
    if request.args.get("from"):
        day_where.append("s.day >= %s")
        day_params.append(request.args["from"])
    if request.args.get("to"):
        day_where.append("s.day <= %s")
        day_params.append(request.args["to"])
    day_clause = ("WHERE " + " AND ".join(day_where)) if day_where else ""
    review_where = where + (" AND " if where else "WHERE ") + "verified_label IS NULL AND confidence < %s"

    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute(
        f"""
        SELECT DATE_FORMAT(s.day, '%%Y-%%m') AS month,
               s.municipality,
               s.label,
               SUM(s.scans) AS n,
               (SELECT COUNT(*) FROM mobile_scans {review_where}) AS needs_review
        FROM scan_daily_stats s {day_clause}
        GROUP BY month, s.municipality, s.label
        """,
        params + [LOW_CONFIDENCE] + day_params,
    )
    groups = cursor.fetchall()
    for g in groups:
        g["municipality"] = g["municipality"] or None  # stored as '' when a scan had none
    # the most and least confident scans in range, both in one round trip
    scoped = where + (" AND " if where else "WHERE ")
    cursor.execute(
        f"""
        (SELECT *, 'high' AS bucket FROM mobile_scans {scoped} confidence >= %s
         ORDER BY confidence DESC, scanned_at DESC LIMIT %s)
        UNION ALL
        (SELECT *, 'low' AS bucket FROM mobile_scans {scoped} confidence < %s
         ORDER BY confidence ASC, scanned_at DESC LIMIT %s)
        """,
        params + [HIGH_CONFIDENCE, DASHBOARD_SCANS] + params + [LOW_CONFIDENCE, DASHBOARD_SCANS],
    )
    extremes = cursor.fetchall()
    cursor.close()
    connection.close()

    total = sum(int(g["n"]) for g in groups)
    diseased = sum(int(g["n"]) for g in groups if g["label"] != "No_Disease")
    needs_review = int(groups[0]["needs_review"]) if groups else 0
    latest = max((g["month"] for g in groups), default=None)  # YYYY-MM of the newest scan in range
    this_month = sum(int(g["n"]) for g in groups if g["month"] == latest)

    counts = {}
    months = {}
    municipalities = {}
    for g in groups:
        n = int(g["n"])
        counts[g["label"]] = counts.get(g["label"], 0) + n
        row = months.setdefault(g["month"], {"month": g["month"], **{label: 0 for label in LABELS}})
        row[g["label"]] += n
        m = municipalities.setdefault(g["municipality"], {"municipality": g["municipality"], "diseased": 0, "total": 0})
        m["total"] += n
        if g["label"] != "No_Disease":
            m["diseased"] += n

    return jsonify({
        "total_scans": total,
        "scans_this_month": this_month,
        "latest_month": latest,
        "diseased_pct": (diseased / total) if total else 0,
        "needs_review": needs_review,
        "by_disease": [{"label": label, "count": counts.get(label, 0)} for label in LABELS],
        "by_month": [months[month] for month in sorted(months)],
        "by_municipality": sorted(
            municipalities.values(),
            key=lambda m: (-m["diseased"], -m["total"], m["municipality"] or ""),
        ),
        "highest_confidence": [serialize(r) for r in extremes if r["bucket"] == "high"],
        "lowest_confidence": [serialize(r) for r in extremes if r["bucket"] == "low"],
    }), 200
