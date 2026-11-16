"""Audit logs: everything that happens in PinePal, for admins.

One timeline of three kinds of rows (see migrate_audit_logs.py):
  activity   every API request (activity_log.py)
  login      every sign-in attempt, web and mobile (copied from login_history by a trigger)
  data       every change to accounts, farmers and scans (database triggers)

GET /api/audit-logs     admin only. Newest first, a page at a time.
  Filters: category (activity | login | data), action (see ACTIONS), user (an account ID),
           from / to (ISO times, from included, to not), search (who, what, the typed
           username, the record's ID or the URL), result (success | failed),
           platform (web | mobile), table (users | farmers | mobile_scans).
  Returns { items, total, page, per_page }.

Data changes made by a request are not listed on their own: they come inside the request's
row as "changes", so one action shows once with what it changed. With category=data or
action=data every change is listed by itself instead. Changes outside the API (scripts) are always listed.

Errors are { "error": "message" }.
"""
import json
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from database import get_connection
from permissions import admin_required

audit_logs = Blueprint("audit_logs", __name__)

CATEGORIES = ("activity", "login", "data")

# the action filter: name -> condition
ACTIONS = {
    "login_success": "(a.category = 'login' AND a.action = 'SUCCESS')",
    "login_failed": "(a.category = 'login' AND a.action = 'FAILED')",
    "logout": "(a.category = 'login' AND a.action = 'LOGOUT')",
    "view": "(a.category = 'activity' AND a.action = 'GET' AND a.path NOT LIKE '/api/scans/export%%')",
    "export": "(a.category = 'activity' AND a.path LIKE '/api/scans/export%%')",
    "create": "(a.category = 'activity' AND a.action = 'POST')",
    "update": "(a.category = 'activity' AND a.action IN ('PUT', 'PATCH'))",
    "delete": "(a.category = 'activity' AND a.action = 'DELETE')",
    "data": "(a.category = 'data')",  # every change by itself, like category=data
}
TABLES = ("users", "farmers", "mobile_scans")
PLATFORMS = ("web", "mobile")
MAX_PER_PAGE = 100

COLUMNS = """
    a.id, a.category, a.action, a.table_name, a.record_id, a.actor_id, a.actor_label, a.ip_address,
    a.request_id, a.summary, a.path, a.status_code, a.duration_ms, a.platform, a.user_agent,
    a.old_values, a.new_values, a.created_at,
    u.username AS actor_username, u.name AS actor_name, u.role AS actor_role
"""

# a data row that belongs to a request (or sign-in) row, so it is shown inside that row
HAS_PARENT = (
    "(a.category = 'data' AND a.request_id IS NOT NULL AND EXISTS ("
    "SELECT 1 FROM audit_logs p WHERE p.request_id = a.request_id AND p.category <> 'data'))"
)


def as_utc(text):
    """An ISO time from the page as the database's plain UTC time."""
    moment = datetime.fromisoformat(text.replace("Z", "+00:00"))
    if moment.tzinfo:
        moment = moment.astimezone(timezone.utc).replace(tzinfo=None)
    return moment


def as_dict(value):
    """A JSON column comes back as text (MySQL) or already parsed; None stays None."""
    if value is None or isinstance(value, dict):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return None


def to_item(r):
    return {
        "id": r["id"],
        "category": r["category"],
        "action": r["action"],
        "table": r["table_name"],
        "record_id": r["record_id"],
        # actor_id is set but actor_name is null when that account was deleted since.
        # For a sign-in, the actor is the account that was signed in to (or tried).
        "actor_id": r["actor_id"],
        "actor_name": r["actor_name"],
        "actor_username": r["actor_username"],
        "actor_role": r["actor_role"],
        "actor_label": r["actor_label"],  # a phone without an account
        "ip_address": r["ip_address"],
        "summary": r["summary"],
        "path": r["path"],
        "status_code": r["status_code"],
        "duration_ms": r["duration_ms"],
        "platform": r["platform"],
        "user_agent": r["user_agent"],
        "old_values": as_dict(r["old_values"]),
        "new_values": as_dict(r["new_values"]),
        # the database clock is UTC; the Z makes the browser show it in local time
        "created_at": r["created_at"].isoformat() + "Z",
    }


@audit_logs.route("/api/audit-logs", methods=["GET"])
@admin_required
def list_audit_logs():
    try:
        page = max(1, int(request.args.get("page", 1)))
        per_page = min(MAX_PER_PAGE, max(1, int(request.args.get("per_page", 25))))
    except ValueError:
        return jsonify({"error": "page and per_page must be numbers"}), 400

    where, params = [], []
    category = request.args.get("category")
    if category in CATEGORIES:
        where.append("a.category = %s")
        params.append(category)
    action = request.args.get("action")
    if action in ACTIONS:
        where.append(ACTIONS[action])
    if category != "data" and action != "data":
        where.append(f"NOT {HAS_PARENT}")

    user = request.args.get("user", "")
    if user.isdigit():
        where.append("a.actor_id = %s")
        params.append(int(user))

    # The page turns the picked days into exact times (the viewer's midnight), since
    # created_at is in UTC. from is included, to is not.
    try:
        if request.args.get("from"):
            where.append("a.created_at >= %s")
            params.append(as_utc(request.args["from"]))
        if request.args.get("to"):
            where.append("a.created_at < %s")
            params.append(as_utc(request.args["to"]))
    except ValueError:
        return jsonify({"error": "from and to must be times like 2026-11-15T16:00:00Z"}), 400

    search = (request.args.get("search") or "").strip()
    if search:
        fields = ["u.username", "u.name", "a.actor_label", "a.summary", "a.record_id", "a.path"]
        where.append("(" + " OR ".join(f"{f} LIKE %s" for f in fields) + ")")
        params += [f"%{search}%"] * len(fields)

    result = request.args.get("result")
    if result == "failed":
        where.append("(a.action = 'FAILED' OR a.status_code >= 400)")
    elif result == "success":
        where.append("NOT (a.action = 'FAILED' OR COALESCE(a.status_code, 0) >= 400)")

    if request.args.get("platform") in PLATFORMS:
        where.append("a.platform = %s")
        params.append(request.args["platform"])
    if request.args.get("table") in TABLES:
        where.append("a.table_name = %s")
        params.append(request.args["table"])

    clause = ("WHERE " + " AND ".join(where)) if where else ""

    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute(f"SELECT COUNT(*) AS n FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id {clause}", params)
    total = int(cursor.fetchone()["n"])
    cursor.execute(
        f"""
        SELECT {COLUMNS}
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.actor_id
        {clause}
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT %s OFFSET %s
        """,
        params + [per_page, (page - 1) * per_page],
    )
    rows = cursor.fetchall()

    # the data changes each listed request made
    changes = {}
    request_ids = [r["request_id"] for r in rows if r["request_id"] and r["category"] != "data"]
    if request_ids:
        cursor.execute(
            f"""
            SELECT {COLUMNS}
            FROM audit_logs a
            LEFT JOIN users u ON u.id = a.actor_id
            WHERE a.category = 'data' AND a.request_id IN ({", ".join(["%s"] * len(request_ids))})
            ORDER BY a.id
            """,
            request_ids,
        )
        for r in cursor.fetchall():
            changes.setdefault(r["request_id"], []).append(to_item(r))
    cursor.close()
    connection.close()

    items = []
    for r in rows:
        item = to_item(r)
        item["changes"] = changes.get(r["request_id"], []) if r["category"] != "data" else []
        items.append(item)

    return jsonify({"items": items, "total": total, "page": page, "per_page": per_page}), 200
