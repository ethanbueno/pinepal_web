"""Database optimization and domain constraints (safe to run more than once).

1. Domain constraints   CHECK rules, so the database itself refuses impossible values: a
                        confidence above 100%, a latitude of 999, a disease that doesn't
                        exist, a password that isn't a bcrypt hash. Every existing row is
                        checked first; a rule the data breaks is reported and skipped.
2. Indexes              composite indexes that match how the app filters scans (by
                        diagnosis, by farmer, newest first) and audit logs (by user).
                        See them used with: python explain_indexes.py
3. Vertical partition   users.password_hash moves to its own table, user_credentials. The
                        users row every page reads no longer carries a secret; only signing
                        in and changing a password touch it (security.py).
4. Horizontal partition audit_logs is split into one partition per month (RANGE on
                        created_at). It is the table that grows fastest, and almost every
                        read is of recent months, so MySQL only opens the months it needs.
                        Each run adds partitions up to 12 months ahead.
5. Aggregate            scan_daily_stats: scans per day, municipality and diagnosis, kept up
                        to date by triggers on mobile_scans, so totals don't need to count
                        every scan. Filled from the existing scans the first time. The
                        staff Dashboard's totals, monthly chart and municipality list read
                        it (GET /api/stats in mobile_scans.py).

Run:  python migrate_optimization.py     (uses the admin login, DB_ADMIN_USER)
Then: python create_app_user.py          (gives the app access to the new tables)
Back up first: python backup.py
"""
import os
import sys
from datetime import date

import pymysql
from dotenv import load_dotenv

import migrate_audit_logs
from database import connect

load_dotenv()

LABELS = ("No_Disease", "Crown_Rot", "Mealybug_Wilt", "Fruit_Rot", "Multiple_Crown", "Fruit_Fasciation")
LABEL_LIST = ", ".join(f"'{label}'" for label in LABELS)

# 1. (table, constraint name, condition). A NULL value always passes a CHECK, so optional
# columns only need the rule for when they have a value. Columns with ON DELETE / ON UPDATE
# foreign key actions can't be in a CHECK (a MySQL rule), so those are left to the keys.
CHECKS = [
    ("mobile_scans", "chk_scans_confidence", "confidence BETWEEN 0 AND 1"),
    ("mobile_scans", "chk_scans_second_confidence", "second_confidence BETWEEN 0 AND 1"),
    ("mobile_scans", "chk_scans_latitude", "latitude BETWEEN -90 AND 90"),
    ("mobile_scans", "chk_scans_longitude", "longitude BETWEEN -180 AND 180"),
    ("mobile_scans", "chk_scans_predicted_label", f"predicted_label IN ({LABEL_LIST})"),
    ("mobile_scans", "chk_scans_second_label", f"second_label IN ({LABEL_LIST})"),
    ("mobile_scans", "chk_scans_verified_label", f"verified_label IN ({LABEL_LIST})"),
    ("mobile_scans", "chk_scans_farmer_label", f"farmer_label IN ({LABEL_LIST})"),
    ("mobile_scans", "chk_scans_farmer_feedback", "farmer_feedback IN ('correct', 'incorrect')"),
    ("mobile_scans", "chk_scans_image_source", "image_source IN ('Camera', 'Gallery', 'Web')"),
    # a verification date needs a label. Not the other way round: scans verified on older
    # versions of the phone app have a label but no date.
    ("mobile_scans", "chk_scans_verified_at_needs_label", "verified_at IS NULL OR verified_label IS NOT NULL"),
    ("farmers", "chk_farmers_full_name", "TRIM(full_name) <> ''"),
    ("farmers", "chk_farmers_size", "farm_size_ha > 0"),
    ("farmers", "chk_farmers_latitude", "farm_latitude BETWEEN -90 AND 90"),
    ("farmers", "chk_farmers_longitude", "farm_longitude BETWEEN -180 AND 180"),
    ("farmers", "chk_farmers_location_together", "(farm_latitude IS NULL) = (farm_longitude IS NULL)"),
    ("farmers", "chk_farmers_is_active", "is_active IN (0, 1)"),
    ("users", "chk_users_username", "CHAR_LENGTH(username) >= 3"),
    ("users", "chk_users_name", "TRIM(name) <> ''"),
    ("users", "chk_users_email", "email LIKE '%_@_%._%'"),
    ("login_history", "chk_login_success", "success IN (0, 1)"),
    ("diseases", "chk_diseases_name", "TRIM(name) <> ''"),
    ("audit_logs", "chk_audit_action",
     "(category = 'data' AND action IN ('INSERT', 'UPDATE', 'DELETE')) "
     "OR (category = 'login' AND action IN ('SUCCESS', 'FAILED', 'LOGOUT')) "
     "OR category = 'activity'"),
    ("audit_logs", "chk_audit_status_code", "status_code BETWEEN 100 AND 599"),
    ("audit_logs", "chk_audit_duration", "duration_ms >= 0"),
]

# 2. (table, index name, columns, index it replaces or None). The scan list, map, export and
# dashboard filter by these and sort newest first. FINAL is the diagnosis the app shows
# (mobile_scans.py), indexed as an expression so "WHERE COALESCE(...) = 'Fruit_Rot'" uses it.
# No (municipality, scanned_at) index: every scan is in Echague (the municipality is locked),
# so it can't narrow anything and MySQL never picks it (checked with explain_indexes.py).
INDEXES = [
    ("mobile_scans", "idx_scans_final_label_date", "(COALESCE(verified_label, predicted_label)), scanned_at", None),
    # farmer_id first, so it also serves the foreign key, and the old one-column index goes
    ("mobile_scans", "idx_scans_farmer_date", "farmer_id, scanned_at", "fk_mobile_scans_farmer"),
    ("audit_logs", "idx_audit_logs_actor_date", "actor_id, created_at", "idx_audit_logs_actor"),
]

CREDENTIALS = """
CREATE TABLE IF NOT EXISTS user_credentials (
  user_id int(11) NOT NULL,
  password_hash varchar(255) NOT NULL,
  updated_at datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (user_id),
  CONSTRAINT fk_credentials_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_credentials_bcrypt CHECK (password_hash LIKE '$2_$%')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
"""

STATS = """
CREATE TABLE IF NOT EXISTS scan_daily_stats (
  day date NOT NULL,
  municipality varchar(100) NOT NULL DEFAULT '',
  label varchar(50) NOT NULL,
  scans int NOT NULL DEFAULT 0,
  PRIMARY KEY (day, municipality, label),
  KEY idx_scan_daily_stats_label (label, day),
  CONSTRAINT chk_stats_scans CHECK (scans >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
"""

# the key a scan is counted under
KEY_NEW = "DATE(NEW.scanned_at), COALESCE(NEW.municipality, ''), COALESCE(NEW.verified_label, NEW.predicted_label)"
KEY_OLD = "DATE(OLD.scanned_at), COALESCE(OLD.municipality, ''), COALESCE(OLD.verified_label, OLD.predicted_label)"
ADD_ONE = (
    f"INSERT INTO scan_daily_stats (day, municipality, label, scans) VALUES ({KEY_NEW}, 1) "
    "ON DUPLICATE KEY UPDATE scans = scans + 1"
)
REMOVE_ONE = (
    "UPDATE scan_daily_stats SET scans = scans - 1 "
    "WHERE (day, municipality, label) = (" + KEY_OLD + "); "
    "DELETE FROM scan_daily_stats WHERE scans = 0 AND (day, municipality, label) = (" + KEY_OLD + ")"
)
STATS_TRIGGERS = {
    "trg_stats_mobile_scans_insert":
        f"CREATE TRIGGER trg_stats_mobile_scans_insert AFTER INSERT ON mobile_scans FOR EACH ROW {ADD_ONE}",
    "trg_stats_mobile_scans_delete":
        f"CREATE TRIGGER trg_stats_mobile_scans_delete AFTER DELETE ON mobile_scans FOR EACH ROW BEGIN {REMOVE_ONE}; END",
    "trg_stats_mobile_scans_update":
        "CREATE TRIGGER trg_stats_mobile_scans_update AFTER UPDATE ON mobile_scans FOR EACH ROW BEGIN "
        f"IF NOT (({KEY_OLD}) <=> ({KEY_NEW})) THEN {REMOVE_ONE}; {ADD_ONE}; END IF; END",
}
FILL_STATS = f"""
INSERT INTO scan_daily_stats (day, municipality, label, scans)
SELECT DATE(scanned_at), COALESCE(municipality, ''), COALESCE(verified_label, predicted_label), COUNT(*)
FROM mobile_scans GROUP BY 1, 2, 3
"""
STATS_MATCH = """
SELECT COUNT(*) AS n FROM (
  SELECT DATE(scanned_at) AS day, COALESCE(municipality, '') AS municipality,
         COALESCE(verified_label, predicted_label) AS label, COUNT(*) AS scans
  FROM mobile_scans GROUP BY 1, 2, 3
) live
LEFT JOIN scan_daily_stats s USING (day, municipality, label)
WHERE NOT (s.scans <=> live.scans)
"""
MONTHS_AHEAD = 12


def exists(cursor, sql, params):
    cursor.execute(sql, params)
    return cursor.fetchone()["n"] > 0


def add_checks(cursor):
    print("\n1. Domain constraints")
    for table, name, condition in CHECKS:
        if exists(cursor, "SELECT COUNT(*) AS n FROM information_schema.TABLE_CONSTRAINTS "
                          "WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = %s", (name,)):
            print(f"   {name}: already there")
            continue
        # NOT (condition) skips NULLs, just like the CHECK will
        cursor.execute(f"SELECT COUNT(*) AS n FROM `{table}` WHERE NOT ({condition.replace('%', '%%')})", ())
        broken = cursor.fetchone()["n"]
        if broken:
            print(f"   {name}: SKIPPED, {broken} existing rows break it. Fix them, then run this again.")
            continue
        cursor.execute(f"ALTER TABLE `{table}` ADD CONSTRAINT `{name}` CHECK ({condition})")
        print(f"   {name}: added")


def add_indexes(cursor):
    print("\n2. Indexes")
    for table, name, columns, replaces in INDEXES:
        if exists(cursor, "SELECT COUNT(*) AS n FROM information_schema.STATISTICS "
                          "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND INDEX_NAME = %s", (table, name)):
            print(f"   {table}.{name}: already there")
        else:
            cursor.execute(f"ALTER TABLE `{table}` ADD INDEX `{name}` ({columns})")
            print(f"   {table}.{name}: added ({columns})")
        if replaces and exists(cursor, "SELECT COUNT(*) AS n FROM information_schema.STATISTICS "
                                       "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND INDEX_NAME = %s",
                               (table, replaces)):
            cursor.execute(f"ALTER TABLE `{table}` DROP INDEX `{replaces}`")
            print(f"   {table}.{replaces}: removed (covered by {name})")


def split_credentials(cursor):
    print("\n3. Vertical partition: users.password_hash -> user_credentials")
    cursor.execute(CREDENTIALS)
    cursor.execute("SHOW COLUMNS FROM users LIKE 'password_hash'")
    if not cursor.fetchone():
        print("   already split")
        return
    cursor.execute("SELECT COUNT(*) AS n FROM users WHERE password_hash NOT LIKE '$2_$%%'", ())
    if cursor.fetchone()["n"]:
        sys.exit("   Some password_hash values are not bcrypt hashes. Nothing was moved.")
    cursor.execute(
        "INSERT INTO user_credentials (user_id, password_hash) SELECT id, password_hash FROM users "
        "ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)"
    )
    cursor.execute(
        "SELECT COUNT(*) AS n FROM users u LEFT JOIN user_credentials c ON c.user_id = u.id "
        "WHERE NOT (c.password_hash <=> u.password_hash)"
    )
    if cursor.fetchone()["n"]:
        sys.exit("   The copied passwords don't match. users.password_hash was kept.")
    cursor.execute("SELECT COUNT(*) AS n FROM user_credentials")
    print(f"   copied {cursor.fetchone()['n']} password hashes, all match")
    # Column first: if the table is busy this fails and nothing has changed. The audit
    # trigger on users still reads password_hash, so it is rebuilt right after (by
    # migrate_audit_logs), watching user_credentials instead.
    cursor.execute("ALTER TABLE users DROP COLUMN password_hash")
    cursor.execute("DROP TRIGGER IF EXISTS trg_audit_users_update")
    print("   removed users.password_hash")


def month_start(year, month):
    return date(year + (month - 1) // 12, (month - 1) % 12 + 1, 1)


def partition_audit_logs(cursor):
    print("\n4. Horizontal partition: audit_logs by month")
    cursor.execute(
        "SELECT PARTITION_NAME FROM information_schema.PARTITIONS WHERE TABLE_SCHEMA = DATABASE() "
        "AND TABLE_NAME = 'audit_logs' AND PARTITION_NAME IS NOT NULL ORDER BY PARTITION_ORDINAL_POSITION"
    )
    existing = [r["PARTITION_NAME"] for r in cursor.fetchall()]

    today = date.today()
    last = month_start(today.year, today.month + MONTHS_AHEAD)
    if existing:
        # the newest month already there: the one before the catch-all pmax
        newest = existing[-2]
        first = month_start(int(newest[1:5]), int(newest[5:7]) + 1)
    else:
        cursor.execute("SELECT MIN(created_at) AS m FROM audit_logs")
        oldest = cursor.fetchone()["m"] or today
        first = date(oldest.year, oldest.month, 1)

    months = []
    current = first
    while current <= last:
        months.append(current)
        current = month_start(current.year, current.month + 1)
    parts = [
        f"PARTITION p{m:%Y%m} VALUES LESS THAN ('{month_start(m.year, m.month + 1):%Y-%m-%d}')"
        for m in months
    ] + ["PARTITION pmax VALUES LESS THAN (MAXVALUE)"]

    if not existing:
        # every unique key has to include the partitioning column, so the key becomes (id, created_at)
        cursor.execute(
            "ALTER TABLE audit_logs DROP PRIMARY KEY, ADD PRIMARY KEY (id, created_at) "
            "PARTITION BY RANGE COLUMNS (created_at) (" + ", ".join(parts) + ")"
        )
        print(f"   partitioned into {len(months)} months ({months[0]:%Y-%m} to {months[-1]:%Y-%m}) plus pmax")
    elif months:
        cursor.execute("ALTER TABLE audit_logs REORGANIZE PARTITION pmax INTO (" + ", ".join(parts) + ")")
        print(f"   added {len(months)} months, now up to {months[-1]:%Y-%m}")
    else:
        print(f"   already partitioned up to {existing[-2][1:5]}-{existing[-2][5:7]}")


def build_stats(cursor):
    print("\n5. Aggregate: scan_daily_stats")
    cursor.execute(STATS)
    for name, statement in STATS_TRIGGERS.items():
        cursor.execute(f"DROP TRIGGER IF EXISTS {name}")
        cursor.execute(statement)
    # refill from the scans, so it starts exactly right (and is repaired if it ever drifts)
    cursor.execute("DELETE FROM scan_daily_stats")
    cursor.execute(FILL_STATS)
    cursor.execute("SELECT COUNT(*) AS n, COALESCE(SUM(scans), 0) AS total FROM scan_daily_stats")
    row = cursor.fetchone()
    cursor.execute(STATS_MATCH)
    wrong = cursor.fetchone()["n"]
    print(f"   {row['n']} day/municipality/diagnosis rows, {row['total']} scans, "
          + ("matches mobile_scans exactly" if not wrong else f"{wrong} rows DON'T match"))


def open_admin():
    """Admin connection that fails fast on a locked table instead of freezing the app
    (see backup.admin_connection)."""
    connection = connect(admin=True, database=os.getenv("DB_NAME"), autocommit=True,
                         cursorclass=pymysql.cursors.DictCursor)
    connection.cursor().execute("SET SESSION lock_wait_timeout = 10, SESSION wait_timeout = 120")
    return connection


def main():
    connection = open_admin()
    cursor = connection.cursor()
    try:
        split_credentials(cursor)
        print("\n   Audit triggers, rebuilt for user_credentials:")
    except pymysql.err.OperationalError as error:
        if error.args[0] == 1205:  # lock wait timeout
            print("   A table was busy, so nothing was removed. Run this again in a minute.")
        raise
    finally:
        cursor.close()
        connection.close()
    migrate_audit_logs.main()

    connection = open_admin()
    cursor = connection.cursor()
    try:
        partition_audit_logs(cursor)
        add_indexes(cursor)
        add_checks(cursor)
        build_stats(cursor)
    finally:
        cursor.close()
        connection.close()
    print("\nDone. Now run: python create_app_user.py")


if __name__ == "__main__":
    main()
