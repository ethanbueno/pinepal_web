import pymysql
import os
import threading
import time
from functools import lru_cache

from dotenv import load_dotenv

from encryption import encrypt_text

# override=True: values in backend/.env win over any DB_* variables already set in Windows
load_dotenv(override=True)

def connect(admin=False, **options):
    """Open a MySQL connection from the DB_* settings in .env.

    DB_PORT defaults to 3306 (local XAMPP). For a hosted database like Aiven, set
    DB_SSL_CA to the path of the downloaded CA certificate so the connection uses SSL.

    Two database logins (least privilege, see create_app_user.py):
      DB_USER / DB_PASSWORD              the app. It can only read and write rows (DML).
      DB_ADMIN_USER / DB_ADMIN_PASSWORD  admin=True: setup_db.py and the migrate_*.py
                                         scripts, which create and change tables and
                                         triggers (DDL). Without them, DB_USER is used.
    """
    user, password = os.getenv("DB_USER"), os.getenv("DB_PASSWORD")
    if admin and os.getenv("DB_ADMIN_USER"):
        user, password = os.getenv("DB_ADMIN_USER"), os.getenv("DB_ADMIN_PASSWORD")

    settings = dict(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=user,
        password=password,
        # Without these a connection the network silently dropped waits forever,
        # and the phone gives up first ("The server took too long to answer").
        connect_timeout=10,
        read_timeout=30,
        write_timeout=30,
    )

    ca = os.getenv("DB_SSL_CA")
    if ca:
        if not os.path.isabs(ca):
            ca = os.path.join(os.path.dirname(os.path.abspath(__file__)), ca)
        settings["ssl"] = {"ca": ca}

    settings.update(options)
    return pymysql.connect(**settings)

# ---------------------------------------------------------------------------
# A small pool, so the API reuses connections instead of opening one per query.
# Opening a connection to a hosted database (TLS + login) takes about half a second; the
# dashboard alone used to open seven. Code keeps calling get_connection() and
# connection.close(); close() now hands the connection back to the pool.
# ---------------------------------------------------------------------------
MAX_IDLE = 6        # connections kept open and waiting
STALE_AFTER = 30    # seconds idle before a connection is replaced with a new one

_idle = []          # [(connection, time it was returned)]
_lock = threading.Lock()


class PooledConnection:
    """A real connection that returns to the pool when closed. Everything else passes through."""

    def __init__(self, connection):
        self._connection = connection
        self._returned = False

    def __getattr__(self, name):
        return getattr(self._connection, name)

    def close(self):
        if self._returned:
            return
        self._returned = True
        try:
            # ends any open transaction, so the next request reads fresh data and
            # nothing half-finished is carried over
            self._connection.rollback()
        except Exception:
            self._discard()
            return
        with _lock:
            if len(_idle) < MAX_IDLE:
                _idle.append((self._connection, time.monotonic()))
                return
        self._discard()

    def _discard(self):
        try:
            self._connection.close()
        except Exception:
            pass


def _close_quietly(connection):
    try:
        connection.close()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Audit logs: the database triggers (migrate_audit_logs.py) record who changed a row by
# reading @audit_user_id, @audit_actor, @audit_ip and @audit_request_id. Every connection handed out during a
# request carries the signed-in user's, and outside a request (scripts) they are NULL.
# ---------------------------------------------------------------------------
NO_ONE = (None, None, None, None)


def audit_context():
    """(user id, label for a phone without an account, IP address, request ID) of the current
    request. The request ID ties the changes a request makes to its activity row
    (activity_log.py). GET requests leave it out: they don't change anything, and leaving it
    out lets a pooled connection skip setting the variables again on every page load."""
    try:
        from flask import g, has_request_context, request
    except ImportError:
        return NO_ONE
    if not has_request_context():
        return NO_ONE
    if "audit_context" in g:
        return g.audit_context

    identity = None
    try:
        from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
    except Exception:  # no token, or an expired one: the change is just not tied to anyone
        pass

    user_id, label = None, None
    if identity:
        identity = str(identity)
        if identity.startswith("device:"):
            label = f"Phone (farmer {identity.removeprefix('device:')})"[:150]
        elif identity.isdigit():
            user_id = int(identity)

    forwarded = request.headers.get("X-Forwarded-For", "")
    ip = _encrypted_ip((forwarded.split(",")[0].strip() or request.remote_addr or "")[:45] or None)

    request_id = None if request.method == "GET" else g.get("request_id")

    g.audit_context = (user_id, label, ip, request_id)
    return g.audit_context


@lru_cache(maxsize=1024)
def _encrypted_ip(ip):
    """The IP address as it is stored: encrypted (encryption.py). Kept per address, so a
    pooled connection whose variables already hold this visitor's IP can skip setting them."""
    return encrypt_text(ip)


def _tag_for_audit(connection):
    """Set the audit variables, skipping the round trip when they are already right."""
    context = audit_context()
    if getattr(connection, "audit_context", NO_ONE) == context:
        return
    cursor = connection.cursor()
    try:
        cursor.execute(
            "SET @audit_user_id = %s, @audit_actor = %s, @audit_ip = %s, @audit_request_id = %s", context
        )
    finally:
        cursor.close()
    connection.audit_context = context


def _new_connection():
    connection = connect(
        database=os.getenv("DB_NAME"),
        cursorclass=pymysql.cursors.DictCursor
    )
    connection.audit_context = NO_ONE  # a new session starts with the variables NULL
    return connection


def get_connection():
    while True:
        with _lock:
            item = _idle.pop() if _idle else None
        if item is None:
            break
        connection, returned_at = item
        if time.monotonic() - returned_at > STALE_AFTER:
            # The network to the hosted database may have dropped it while idle, and
            # checking with a ping can hang on a dropped one. A new connection only
            # takes about half a second, so close it and move on.
            _close_quietly(connection)
            continue
        try:
            _tag_for_audit(connection)
        except Exception:
            _close_quietly(connection)  # the network dropped it after all: open a new one
            continue
        return PooledConnection(connection)

    connection = _new_connection()
    _tag_for_audit(connection)
    return PooledConnection(connection)
