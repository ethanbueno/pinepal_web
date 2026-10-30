import pymysql
import os
import threading
import time
from dotenv import load_dotenv

# override=True: values in backend/.env win over any DB_* variables already set in Windows
load_dotenv(override=True)

def connect(**options):
    """Open a MySQL connection from the DB_* settings in .env.

    DB_PORT defaults to 3306 (local XAMPP). For a hosted database like Aiven, set
    DB_SSL_CA to the path of the downloaded CA certificate so the connection uses SSL.
    """
    settings = dict(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
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
STALE_AFTER = 30    # seconds idle before a connection is checked with a ping

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


def get_connection():
    while True:
        with _lock:
            item = _idle.pop() if _idle else None
        if item is None:
            break
        connection, returned_at = item
        if time.monotonic() - returned_at > STALE_AFTER:
            try:
                connection.ping(reconnect=False)  # the server may have dropped it while idle
            except Exception:
                try:
                    connection.close()
                except Exception:
                    pass
                continue
        return PooledConnection(connection)

    return PooledConnection(connect(
        database=os.getenv("DB_NAME"),
        cursorclass=pymysql.cursors.DictCursor
    ))
