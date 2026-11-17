"""Activity log: one audit_logs row (category 'activity') for every API request.

init_activity_log(app) hooks into Flask:
  before_request   gives the request an ID and notes the time. The ID is also set on the
                   database connections of requests that can change data (database.py), so
                   the data triggers tag their rows with it and the Audit logs page shows those
                   changes under the request that made them.
  after_request    puts the row on a queue. The query parameters (a list's or an export's
                   filters) go in new_values as {"filters": {...}}. A background thread writes it, so the answer
                   never waits for the log, and a failure to log never fails a request.

Not logged: CORS preflights (OPTIONS), images and other files, the API's home page,
admins reading the audit logs themselves (every filter change would add a row), and views
with nothing sensitive in them (SKIPPED_ENDPOINTS). Views of farmer names, locations and
accounts are kept, and so is every change and export. Sign-in
requests get no activity row either, because login_history already records them and a
trigger copies that row into audit_logs with the same request ID.
"""
import json
import logging
import queue
import threading
import time
import uuid

from flask import g, request

from database import audit_context, get_connection

log = logging.getLogger(__name__)

SKIPPED_ENDPOINTS = {
    "static", "home", "scans.uploaded_file", "audit_logs.list_audit_logs",
    # Views with nothing sensitive in them. Only views of farmer names, locations and
    # accounts are worth a row (the farmer, scan, map and user lists and pages), plus exports.
    "web_auth.me",                # opening the dashboard: just the signed-in user's own account
    "users.get_me",
    "profile.get_profile",        # their own profile
    "farmers.my_farmer",          # a farmer's own farm
    "mobile_scans.stats",         # dashboard totals, no names
    "mobile_scans.count_scans",   # a number, e.g. the Export page's row count
    "scans.list_diseases",        # the disease guide
    "mobile_sync.my_scans",       # a phone loading its own scans
}

# what each endpoint does, in words; {name} is filled from the URL
DESCRIPTIONS = {
    "web_auth.login": "Signed in on the web",
    "web_auth.logout": "Signed out",
    "web_auth.register": "Registered an account",
    "password_reset.forgot_password": "Asked for a password reset code",
    "password_reset.reset_password": "Reset their password with an emailed code",
    "auth.login": "Signed in (old endpoint)",
    "auth.register": "Registered an account (old endpoint)",
    "users.get_all_users": "Viewed the user list",
    "users.create_user": "Created a user",
    "users.get_user": "Viewed user #{id}",
    "users.update_user": "Updated user #{id}",
    "users.delete_user": "Deleted user #{id}",
    "profile.update_profile": "Updated their profile",
    "profile.change_password": "Changed their password",
    "farmers.list_farmers": "Viewed the farmer list",
    "farmers.create_farmer": "Added a farmer",
    "farmers.get_farmer": "Viewed farmer {farmer_id}",
    "farmers.update_farmer": "Updated farmer {farmer_id}",
    "farmers.set_status": "Changed the status of farmer {farmer_id}",
    "farmers.sync_farmer": "Linked farmer {farmer_id} to an account",
    "mobile_scans.list_scans": "Viewed the scan list",
    "mobile_scans.create_scan": "Saved a scan",
    "mobile_scans.get_scan": "Viewed a scan",
    "mobile_scans.delete_scan": "Deleted a scan",
    "mobile_scans.verify_scan": "Verified a scan",
    "mobile_scans.export_scans": "Exported scans",
    "mobile_scans.map_scans": "Viewed the disease map",
    "diagnose.diagnose_image": "Ran a disease diagnosis",
    "mobile_sync.register_phone": "Registered a phone",
    "mobile_sync.mobile_login": "Signed in on the mobile app",
    "mobile_sync.upload_scan": "Synced a scan from the phone",
}

# the record a request was about, from the URL: view argument -> table
RECORD_ARGS = {"id": "users", "farmer_id": "farmers", "scan_uuid": "mobile_scans"}

INSERT = (
    "INSERT INTO audit_logs (category, action, table_name, record_id, actor_id, actor_label, ip_address, "
    "request_id, summary, path, status_code, duration_ms, platform, user_agent, new_values) "
    "VALUES ('activity', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
)

# query parameters never worth keeping
HIDDEN_ARGS = {"page", "per_page"}


def request_filters():
    """The request's query parameters (the filters of a list or an export), or None."""
    filters = {k: v for k, v in request.args.items() if k not in HIDDEN_ARGS and v != ""}
    if not filters:
        return None
    return json.dumps({"filters": {k: v[:200] for k, v in list(filters.items())[:30]}})

_pending = queue.Queue(maxsize=10000)
_writer_started = False
_writer_lock = threading.Lock()


def _write_forever():
    while True:
        row = _pending.get()
        try:
            connection = get_connection()
            cursor = connection.cursor()
            try:
                cursor.execute(INSERT, row)
                connection.commit()
            finally:
                cursor.close()
                connection.close()
        except Exception:
            log.exception("Could not save an activity log row")


def _start_writer():
    global _writer_started
    with _writer_lock:
        if not _writer_started:
            threading.Thread(target=_write_forever, name="activity-log", daemon=True).start()
            _writer_started = True


def describe(endpoint, view_args):
    if endpoint == "mobile_scans.export_scans":
        return "Exported scans as " + ("XLSX" if request.args.get("format") == "xlsx" else "CSV")
    text = DESCRIPTIONS.get(endpoint)
    if not text:
        return f"{request.method} {request.path}"
    try:
        return text.format(**view_args)
    except (KeyError, IndexError):
        return text


def init_activity_log(app):
    @app.before_request
    def start_request():
        g.request_id = uuid.uuid4().hex
        g.request_started = time.monotonic()

    @app.after_request
    def log_request(response):
        try:
            endpoint = request.endpoint
            if (
                request.method == "OPTIONS"
                or endpoint in SKIPPED_ENDPOINTS
                or g.get("login_recorded")  # the login row stands for this request
            ):
                return response

            view_args = request.view_args or {}
            table, record = None, None
            for arg, arg_table in RECORD_ARGS.items():
                if arg in view_args:
                    table, record = arg_table, str(view_args[arg])[:64]
                    break

            user_id, label, ip, _ = audit_context()
            started = g.get("request_started")
            duration = int((time.monotonic() - started) * 1000) if started else None
            platform = "mobile" if request.path.startswith("/api/mobile") else "web"

            _start_writer()
            _pending.put_nowait((
                request.method,
                table,
                record,
                user_id,
                label,
                ip,
                g.get("request_id"),
                describe(endpoint, view_args)[:255],
                request.path[:255],
                response.status_code,
                duration,
                platform,
                (request.headers.get("User-Agent") or "")[:255],
                request_filters(),
            ))
        except queue.Full:
            log.warning("Activity log queue is full; a request was not logged")
        except Exception:  # the log is a record, not part of answering
            log.exception("Could not queue an activity log row")
        return response
