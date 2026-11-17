"""Back up PinePal: the whole database and every scan photo, in one dated .zip file.

    python backup.py                 saves backups/pinepal_backup_YYYY-MM-DD_HHMMSS.zip
    python backup.py --out D:\\usb    saves it in another folder (a USB stick, a synced Drive folder)

The zip holds:
  database.sql    every table's structure and rows, then the triggers. One statement per
                  line. Read from one consistent snapshot, so a scan saved while the backup
                  runs is either fully in it or not at all.
  uploads/        the scan photos from backend/uploads (they are not in the database or git)
  manifest.json   when it was made, the row count of every table, the photo list, and a
                  SHA-256 checksum of database.sql, so restore.py can tell if the file is
                  damaged and prove that nothing is missing.

Encrypted: with DATA_ENCRYPTION_KEY in .env (encryption.py), database.sql and every photo are
encrypted inside the zip (database.sql.enc, uploads/<photo>.enc), so a copied or lost backup
can't be read without the key. Only manifest.json (counts, names, checksums) stays readable.
Keep the key somewhere apart from the backups, such as a password manager.

It uses the admin login (DB_ADMIN_USER), because only that one can read the table and
trigger definitions. Each backup is also recorded in the audit logs.

Restore with restore.py. The plan for when and how is in BACKUP_AND_RECOVERY.md.
"""
import argparse
import getpass
import hashlib
import json
import os
import zipfile
from datetime import datetime, timezone

import pymysql

from database import connect
from encryption import cipher, encrypt_bytes

HERE = os.path.dirname(os.path.abspath(__file__))
BACKUP_DIR = os.path.join(HERE, "backups")
UPLOAD_DIR = os.path.join(HERE, "uploads")
FORMAT_VERSION = 1
ROWS_PER_INSERT = 200


def admin_connection(database=None):
    """The admin login, set up so a script can never leave the live app stuck:
    lock_wait_timeout  give up after 10 s if a table is locked, instead of waiting (and
                       making every app query on that table queue up behind it)
    wait_timeout       if the network drops mid-script, the server closes the orphaned
                       session after 2 minutes instead of 8 hours, releasing its locks
    """
    connection = connect(admin=True, database=database, autocommit=True)
    cursor = connection.cursor()
    cursor.execute("SET SESSION lock_wait_timeout = 10, SESSION wait_timeout = 120")
    cursor.close()
    return connection


def one_line(sql):
    """SHOW CREATE output spans lines; as SQL, a space between clauses means the same."""
    return " ".join(sql.replace("\r", "").split("\n"))


def log_event(action, summary):
    """Record a backup or restore in audit_logs, as a script run (not a web request)."""
    try:
        connection = admin_connection(os.getenv("DB_NAME"))
        cursor = connection.cursor()
        cursor.execute(
            "INSERT INTO audit_logs (category, action, actor_label, summary) VALUES ('activity', %s, %s, %s)",
            (action, f"Script run by {getpass.getuser()}"[:150], summary[:255]),
        )
        connection.close()
    except Exception as error:  # the backup itself still counts
        print(f"(Could not record this in the audit logs: {error})")


def dump_database(connection):
    """The database as SQL lines, and {table: row count}."""
    cursor = connection.cursor()
    # one snapshot for every table, without locking the app out
    cursor.execute("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ")
    cursor.execute("START TRANSACTION WITH CONSISTENT SNAPSHOT")

    cursor.execute("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")
    tables = sorted(row[0] for row in cursor.fetchall())

    lines = [
        f"-- PinePal database backup, {datetime.now(timezone.utc).isoformat(timespec='seconds')}",
        "-- One statement per line. Restore with restore.py.",
        "SET NAMES utf8mb4",
        "SET FOREIGN_KEY_CHECKS = 0",
    ]
    counts = {}
    for table in tables:
        cursor.execute(f"SHOW CREATE TABLE `{table}`")
        lines.append(f"-- table {table}")
        lines.append(one_line(cursor.fetchone()[1]))

        cursor.execute(f"SELECT * FROM `{table}`")
        columns = ", ".join(f"`{d[0]}`" for d in cursor.description)
        rows = cursor.fetchall()
        counts[table] = len(rows)
        for start in range(0, len(rows), ROWS_PER_INSERT):
            values = ", ".join(
                "(" + ", ".join(connection.escape(v) for v in row) + ")"
                for row in rows[start:start + ROWS_PER_INSERT]
            )
            lines.append(f"INSERT INTO `{table}` ({columns}) VALUES {values}")

    # Triggers last, so restoring the rows doesn't fire them (no audit rows for a restore).
    cursor.execute(
        "SELECT TRIGGER_NAME, ACTION_TIMING, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_STATEMENT "
        "FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() ORDER BY TRIGGER_NAME"
    )
    triggers = cursor.fetchall()
    for name, timing, event, table, body in triggers:
        lines.append(f"-- trigger {name}")
        lines.append(one_line(f"CREATE TRIGGER `{name}` {timing} {event} ON `{table}` FOR EACH ROW {body}"))

    lines.append("SET FOREIGN_KEY_CHECKS = 1")
    cursor.execute("COMMIT")
    cursor.close()
    return "\n".join(lines) + "\n", counts, len(triggers)


def photo_files():
    if not os.path.isdir(UPLOAD_DIR):
        return []
    return sorted(f for f in os.listdir(UPLOAD_DIR) if os.path.isfile(os.path.join(UPLOAD_DIR, f)))


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description="Back up the PinePal database and scan photos.")
    parser.add_argument("--out", default=BACKUP_DIR, help="folder to save the zip in (default: backups/)")
    args = parser.parse_args()

    database = os.getenv("DB_NAME")
    connection = admin_connection(database)
    print(f"Reading {database}...")
    sql, counts, trigger_count = dump_database(connection)
    cursor = connection.cursor()
    cursor.execute("SELECT VERSION()")
    server = cursor.fetchone()[0]
    connection.close()

    sql_bytes = sql.encode("utf-8")
    photos = []
    for name in photo_files():
        with open(os.path.join(UPLOAD_DIR, name), "rb") as f:
            photos.append((name, f.read()))

    created = datetime.now()
    manifest = {
        "format": FORMAT_VERSION,
        "created_at": created.astimezone().isoformat(timespec="seconds"),
        "database": database,
        "server_version": server,
        "tables": counts,
        "triggers": trigger_count,
        "database_sql_sha256": sha256(sql_bytes),
        "photos": {name: sha256(data) for name, data in photos},
        # the checksums are of the readable files; restore.py checks them after decrypting
        "encrypted": cipher() is not None,
    }
    encrypted = manifest["encrypted"]
    if not encrypted:
        print("WARNING: DATA_ENCRYPTION_KEY is not set, so this backup is NOT encrypted.")
    suffix = ".enc" if encrypted else ""
    seal = encrypt_bytes if encrypted else (lambda data: data)

    os.makedirs(args.out, exist_ok=True)
    path = os.path.join(args.out, f"pinepal_backup_{created:%Y-%m-%d_%H%M%S}.zip")
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("database.sql" + suffix, seal(sql_bytes))
        for name, data in photos:
            archive.writestr(f"uploads/{name}{suffix}", seal(data))
        archive.writestr("manifest.json", json.dumps(manifest, indent=2))

    total_rows = sum(counts.values())
    size_kb = os.path.getsize(path) / 1024
    print(f"Saved {path}")
    print(f"  {len(counts)} tables, {total_rows} rows, {trigger_count} triggers, {len(photos)} photos, {size_kb:.0f} KB"
          + (", encrypted" if encrypted else ", NOT encrypted"))
    for table, n in counts.items():
        print(f"  {table:40} {n:>6} rows")
    print("Copy it somewhere off this laptop too (Google Drive, a USB stick).")
    log_event("BACKUP", f"Backed up the database and {len(photos)} photos"
              f"{', encrypted' if encrypted else ''} ({os.path.basename(path)})")


if __name__ == "__main__":
    try:
        main()
    except pymysql.err.OperationalError as error:
        raise SystemExit(f"Could not reach the database: {error}")
