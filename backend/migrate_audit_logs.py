"""Add the audit_logs table and the database triggers that fill it (safe to run more than once).

audit_logs is the one timeline of everything that happens in PinePal. Its category says
what kind of event a row is:

  activity   every API request: who, what, the answer's status code, how long it took.
             Written by the API (activity_log.py) after each request.
  login      every sign-in attempt, web and mobile. A trigger copies each new login_history
             row (login_history.py) here; this script also copies the older ones once.
  data       every change to accounts, farmers and scans, written by triggers.

The data triggers live in MySQL itself, so every change is recorded, whichever code
(or a hand-written query) made it:

  users         INSERT / UPDATE / DELETE   (the password hash is never copied; a new
                                            password shows only as "password": "changed")
  farmers       INSERT / UPDATE / DELETE
  mobile_scans  INSERT / UPDATE / DELETE   (a phone re-syncing the same scan only bumps
                                            synced_at, which is not audited, so it adds nothing)

An UPDATE row holds only the columns that changed, old and new. Who made the change comes
from session variables the API sets on each connection (database.py): @audit_user_id,
@audit_actor (a phone without an account), @audit_ip and @audit_request_id. The request ID
ties a change to the activity row of the request that made it. Changes made outside the
API have none of them, and show as "System".

audit_logs itself can't be edited or deleted: two more triggers refuse it. To clear it on
purpose, drop trg_audit_logs_no_update / trg_audit_logs_no_delete first.

Admins read it at GET /api/audit-logs (audit_logs.py) and on the Audit logs page.

Run once:  python migrate_audit_logs.py
"""
import os
import sys

import pymysql
from dotenv import load_dotenv

from database import connect

load_dotenv()

CREATE = """
CREATE TABLE IF NOT EXISTS audit_logs (
  id bigint NOT NULL AUTO_INCREMENT,
  category enum('activity','login','data') NOT NULL DEFAULT 'data',
  -- data: INSERT / UPDATE / DELETE, login: SUCCESS / FAILED, activity: the HTTP method
  action varchar(20) NOT NULL,
  table_name varchar(30) DEFAULT NULL,
  record_id varchar(64) DEFAULT NULL,
  actor_id int(11) DEFAULT NULL,
  actor_label varchar(150) DEFAULT NULL,
  ip_address varchar(255) DEFAULT NULL,  -- encrypted (encryption.py)
  request_id char(32) DEFAULT NULL,
  -- activity: what was done, in words. login: the username or email that was typed
  summary varchar(255) DEFAULT NULL,
  path varchar(255) DEFAULT NULL,
  status_code smallint DEFAULT NULL,
  duration_ms int DEFAULT NULL,
  platform varchar(10) DEFAULT NULL,
  user_agent varchar(255) DEFAULT NULL,
  old_values json DEFAULT NULL,
  new_values json DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY idx_audit_logs_created (created_at),
  KEY idx_audit_logs_category (category, created_at),
  KEY idx_audit_logs_record (table_name, record_id),
  KEY idx_audit_logs_actor (actor_id),
  KEY idx_audit_logs_request (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
"""

# The first version of the table only had data changes. Bring it up to date in place.
UPGRADE = """
ALTER TABLE audit_logs
  ADD COLUMN category enum('activity','login','data') NOT NULL DEFAULT 'data' AFTER id,
  MODIFY action varchar(20) NOT NULL,
  MODIFY table_name varchar(30) DEFAULT NULL,
  MODIFY record_id varchar(64) DEFAULT NULL,
  ADD COLUMN request_id char(32) DEFAULT NULL AFTER ip_address,
  ADD COLUMN summary varchar(255) DEFAULT NULL AFTER request_id,
  ADD COLUMN path varchar(255) DEFAULT NULL AFTER summary,
  ADD COLUMN status_code smallint DEFAULT NULL AFTER path,
  ADD COLUMN duration_ms int DEFAULT NULL AFTER status_code,
  ADD COLUMN platform varchar(10) DEFAULT NULL AFTER duration_ms,
  ADD COLUMN user_agent varchar(255) DEFAULT NULL AFTER platform,
  ADD KEY idx_audit_logs_category (category, created_at),
  ADD KEY idx_audit_logs_request (request_id)
"""

# login_history rows from before the login trigger existed
BACKFILL_LOGINS = """
INSERT INTO audit_logs (category, action, table_name, record_id, actor_id, ip_address,
                        summary, platform, user_agent, new_values, created_at)
SELECT 'login', IF(h.success, 'SUCCESS', 'FAILED'), 'login_history', CAST(h.id AS CHAR), h.user_id,
       h.ip_address, h.username, h.platform, h.user_agent,
       JSON_OBJECT('username', h.username, 'reason', h.reason), h.created_at
FROM login_history h
WHERE NOT EXISTS (
  SELECT 1 FROM audit_logs a
  WHERE a.category = 'login' AND a.table_name = 'login_history'
    AND a.record_id = CAST(h.id AS CHAR) COLLATE utf8mb4_general_ci
)
ORDER BY h.id
"""

# table: (primary key column, audited columns). Columns left out are not worth a log row
# (users.created_at, mobile_scans.synced_at / image_path) or are secret (users.password_hash).
AUDITED = {
    "users": ("id", ["email", "username", "role", "name", "municipality"]),
    "farmers": ("farmer_id", [
        "user_id", "full_name", "farm_name", "municipality",
        "farm_latitude", "farm_longitude", "farm_size_ha", "is_active",
    ]),
    "mobile_scans": ("scan_uuid", [
        "farmer_id", "saved_by", "saved_by_name", "farm_name", "municipality",
        "latitude", "longitude", "scanned_at", "predicted_label", "confidence",
        "second_label", "second_confidence", "image_source",
        "verified_label", "verified_by", "notes", "verified_at",
        "farmer_feedback", "farmer_label",
    ]),
}

INSERT_LOG = (
    "INSERT INTO audit_logs (category, table_name, action, record_id, actor_id, actor_label, ip_address, "
    "request_id, old_values, new_values) "
    "VALUES ('data', '{table}', '{action}', CAST({row}.{key} AS CHAR), @audit_user_id, @audit_actor, @audit_ip, "
    "@audit_request_id, {old}, {new})"
)


def json_object(row, columns):
    return "JSON_OBJECT(" + ", ".join(f"'{c}', {row}.{c}" for c in columns) + ")"


def triggers_for(table, key, columns, password_in_users=False):
    """The three CREATE TRIGGER statements for one table, by name."""
    everything = [key] + columns
    statements = {}

    statements[f"trg_audit_{table}_insert"] = (
        f"CREATE TRIGGER trg_audit_{table}_insert AFTER INSERT ON {table} FOR EACH ROW "
        + INSERT_LOG.format(table=table, action="INSERT", row="NEW", key=key,
                            old="NULL", new=json_object("NEW", everything))
    )

    statements[f"trg_audit_{table}_delete"] = (
        f"CREATE TRIGGER trg_audit_{table}_delete AFTER DELETE ON {table} FOR EACH ROW "
        + INSERT_LOG.format(table=table, action="DELETE", row="OLD", key=key,
                            old=json_object("OLD", everything), new="NULL")
    )

    # only the columns that changed; <=> also treats NULL -> value as a change
    checks = [
        f"IF NOT (OLD.{c} <=> NEW.{c}) THEN "
        f"SET o = JSON_SET(o, '$.{c}', OLD.{c}); SET n = JSON_SET(n, '$.{c}', NEW.{c}); SET changed = 1; "
        f"END IF;"
        for c in everything
    ]
    if table == "users" and password_in_users:  # before the split into user_credentials
        checks.append(
            "IF NOT (OLD.password_hash <=> NEW.password_hash) THEN "
            "SET n = JSON_SET(n, '$.password', 'changed'); SET changed = 1; END IF;"
        )
    statements[f"trg_audit_{table}_update"] = (
        f"CREATE TRIGGER trg_audit_{table}_update AFTER UPDATE ON {table} FOR EACH ROW BEGIN "
        "DECLARE o LONGTEXT DEFAULT '{}'; DECLARE n LONGTEXT DEFAULT '{}'; DECLARE changed INT DEFAULT 0; "
        + " ".join(checks)
        + " IF changed THEN "
        + INSERT_LOG.format(table=table, action="UPDATE", row="NEW", key=key, old="o", new="n")
        + "; END IF; END"
    )
    return statements


# Each sign-in attempt. The actor is the account that was signed in to (or tried), since no
# one is signed in yet while logging in.
LOGIN = {
    "trg_audit_login_history_insert": (
        "CREATE TRIGGER trg_audit_login_history_insert AFTER INSERT ON login_history FOR EACH ROW "
        "INSERT INTO audit_logs (category, action, table_name, record_id, actor_id, ip_address, request_id, "
        "summary, platform, user_agent, new_values, created_at) "
        "VALUES ('login', IF(NEW.success, 'SUCCESS', 'FAILED'), 'login_history', CAST(NEW.id AS CHAR), "
        "NEW.user_id, NEW.ip_address, @audit_request_id, NEW.username, NEW.platform, NEW.user_agent, "
        "JSON_OBJECT('username', NEW.username, 'reason', NEW.reason), NEW.created_at)"
    ),
}

# Passwords live in user_credentials (migrate_optimization.py). A new or changed hash shows
# as "password": "changed" on the account, like any other change to it. The hash itself is
# never copied. A new account's first password is part of its INSERT row, so not logged here.
CREDENTIALS = {
    "trg_audit_user_credentials_update": (
        "CREATE TRIGGER trg_audit_user_credentials_update AFTER UPDATE ON user_credentials FOR EACH ROW "
        "INSERT INTO audit_logs (category, table_name, action, record_id, actor_id, actor_label, ip_address, "
        "request_id, old_values, new_values) "
        "SELECT 'data', 'users', 'UPDATE', CAST(NEW.user_id AS CHAR), @audit_user_id, @audit_actor, @audit_ip, "
        "@audit_request_id, JSON_OBJECT(), JSON_OBJECT('password', 'changed') "
        "FROM DUAL WHERE NOT (OLD.password_hash <=> NEW.password_hash)"
    ),
}

# the log can only grow: editing or deleting a row is refused
PROTECT = {
    "trg_audit_logs_no_update": (
        "CREATE TRIGGER trg_audit_logs_no_update BEFORE UPDATE ON audit_logs FOR EACH ROW "
        "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit logs cannot be changed'"
    ),
    "trg_audit_logs_no_delete": (
        "CREATE TRIGGER trg_audit_logs_no_delete BEFORE DELETE ON audit_logs FOR EACH ROW "
        "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit logs cannot be deleted'"
    ),
}


def all_triggers(password_in_users=False, has_credentials=True):
    statements = {}
    for table, (key, columns) in AUDITED.items():
        statements.update(triggers_for(table, key, columns, password_in_users))
    statements.update(LOGIN)
    if has_credentials:
        statements.update(CREDENTIALS)
    statements.update(PROTECT)
    return statements


def password_layout(cursor):
    """(users still has password_hash, user_credentials exists)"""
    cursor.execute("SHOW COLUMNS FROM users LIKE 'password_hash'")
    in_users = cursor.fetchone() is not None
    cursor.execute("SHOW TABLES LIKE 'user_credentials'")
    return in_users, cursor.fetchone() is not None


def main():
    connection = connect(admin=True,
        database=os.getenv("DB_NAME"),
        autocommit=True,
        cursorclass=pymysql.cursors.DictCursor,
    )
    cursor = connection.cursor()
    try:
        cursor.execute(CREATE)
        cursor.execute("SHOW COLUMNS FROM audit_logs LIKE 'category'")
        if not cursor.fetchone():
            cursor.execute(UPGRADE)
            print("Updated audit_logs for activity and sign-ins")
        print("audit_logs table is ready")

        try:
            # dropped and created again, so running this after editing AUDITED updates them
            for name, statement in all_triggers(*password_layout(cursor)).items():
                cursor.execute(f"DROP TRIGGER IF EXISTS {name}")
                cursor.execute(statement)
                print("Trigger", name)
        except pymysql.err.OperationalError as error:
            if error.args[0] == 1419:
                sys.exit(
                    "The database refused to create triggers because binary logging is on and this "
                    "account is not SUPER. Turn on log_bin_trust_function_creators (Aiven: the "
                    "service's Advanced configuration; XAMPP: my.ini), then run this again."
                )
            raise

        # after the trigger exists, so no sign-in can fall between the copy and the trigger
        cursor.execute(BACKFILL_LOGINS)
        print(f"Copied {cursor.rowcount} earlier sign-in attempts")
    finally:
        cursor.close()
        connection.close()
    print("Done: requests, sign-ins and changes to users, farmers and mobile_scans are now audited")


if __name__ == "__main__":
    main()
