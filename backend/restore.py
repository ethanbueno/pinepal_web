"""Restore a PinePal backup made by backup.py, and prove nothing is missing.

    python restore.py                     the newest backup in backups/, into a TEST database
    python restore.py backups/pinepal_backup_2026-11-16_143000.zip
    python restore.py --drop-test         ... and delete the test database afterwards
    python restore.py FILE --live         put the backup back into the real database

Test restore (the default) never touches the real data. It:
  1. checks the zip against its manifest (SHA-256 of database.sql and of every photo),
  2. rebuilds everything in a separate database, pinepal_restore_test,
  3. counts the rows in every restored table and compares them with the backup's counts,
     and shows the live database's counts next to them for reference,
  4. unpacks the photos into backups/restore_test_uploads/ and checks each one.
This is the recovery drill: run it after making a backup to know the backup really works.
An encrypted backup (encryption.py) is decrypted first, which needs the same
DATA_ENCRYPTION_KEY that made it.

--live replaces the real database (DB_NAME) and puts the photos back in uploads/. It asks
you to type the database name first, and makes a safety backup of the current data before
changing anything, so even a wrong restore can be undone.

Uses the admin login (DB_ADMIN_USER), since it creates tables and triggers. Each restore is
recorded in the audit logs.
"""
import argparse
import glob
import hashlib
import json
import os
import sys
import zipfile

import pymysql

import backup
from backup import BACKUP_DIR, UPLOAD_DIR, admin_connection, log_event
from encryption import decrypt_bytes

TEST_DATABASE = "pinepal_restore_test"
TEST_UPLOADS = os.path.join(BACKUP_DIR, "restore_test_uploads")


def newest_backup():
    files = sorted(glob.glob(os.path.join(BACKUP_DIR, "pinepal_backup_*.zip")))
    if not files:
        raise SystemExit("No backups in backups/ yet. Make one with: python backup.py")
    return files[-1]


def read_backup(path):
    """(manifest, database.sql text, {photo name: bytes}), after decrypting (encrypted backups)
    and checking every checksum. Backups made before encryption are read as they are."""
    with zipfile.ZipFile(path) as archive:
        manifest = json.loads(archive.read("manifest.json"))
        encrypted = manifest.get("encrypted", False)
        suffix = ".enc" if encrypted else ""
        unseal = decrypt_bytes if encrypted else (lambda data: data)
        sql_bytes = unseal(archive.read("database.sql" + suffix))
        photos = {name: unseal(archive.read(f"uploads/{name}{suffix}")) for name in manifest["photos"]}

    if hashlib.sha256(sql_bytes).hexdigest() != manifest["database_sql_sha256"]:
        raise SystemExit("database.sql does not match its checksum: this backup is damaged.")
    bad = [n for n, data in photos.items() if hashlib.sha256(data).hexdigest() != manifest["photos"][n]]
    if bad:
        raise SystemExit(f"{len(bad)} photos do not match their checksums: this backup is damaged.")
    return manifest, sql_bytes.decode("utf-8"), photos


def run_sql(cursor, sql):
    statements = [line for line in sql.split("\n") if line.strip() and not line.startswith("--")]
    for statement in statements:
        cursor.execute(statement)
    return len(statements)


def count_rows(database, tables):
    connection = admin_connection(database)
    cursor = connection.cursor()
    counts = {}
    for table in tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM `{table}`")
            counts[table] = cursor.fetchone()[0]
        except pymysql.err.ProgrammingError:
            counts[table] = None  # the table isn't there
    cursor.execute("SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()")
    triggers = cursor.fetchone()[0]
    connection.close()
    return counts, triggers


def empty_database(cursor, database):
    """Drop every table (and with them, their triggers) in the database."""
    cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
    cursor.execute(f"SHOW FULL TABLES FROM `{database}` WHERE Table_type = 'BASE TABLE'")
    for table, _type in cursor.fetchall():
        cursor.execute(f"DROP TABLE `{database}`.`{table}`")
    cursor.execute("SET FOREIGN_KEY_CHECKS = 1")


def main():
    parser = argparse.ArgumentParser(description="Restore a PinePal backup.")
    parser.add_argument("file", nargs="?", help="the backup zip (default: the newest in backups/)")
    parser.add_argument("--live", action="store_true", help="restore into the REAL database instead of a test one")
    parser.add_argument("--drop-test", action="store_true", help="delete the test database after checking it")
    args = parser.parse_args()

    path = args.file or newest_backup()
    live_database = os.getenv("DB_NAME")
    target = live_database if args.live else TEST_DATABASE

    print(f"Backup: {os.path.basename(path)}")
    manifest, sql, photos = read_backup(path)
    print(f"  made {manifest['created_at']} from {manifest['database']}, "
          f"{'decrypted, ' if manifest.get('encrypted') else ''}checksums OK "
          f"({len(manifest['tables'])} tables, {len(photos)} photos)")

    if args.live:
        print(f"\nThis REPLACES everything in the real database '{live_database}' and the photo folder.")
        if input(f"Type {live_database} to continue: ").strip() != live_database:
            raise SystemExit("Stopped. Nothing was changed.")
        print("Making a safety backup of the current data first...")
        sys.argv = [sys.argv[0]]
        backup.main()

    connection = admin_connection()
    cursor = connection.cursor()
    if args.live:
        empty_database(cursor, target)
    else:
        cursor.execute(f"DROP DATABASE IF EXISTS `{target}`")
        cursor.execute(f"CREATE DATABASE `{target}` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci")
    cursor.execute(f"USE `{target}`")
    print(f"\nRestoring into {target}...")
    statements = run_sql(cursor, sql)
    connection.close()
    print(f"  ran {statements} statements")

    # photos
    photo_dir = UPLOAD_DIR if args.live else TEST_UPLOADS
    os.makedirs(photo_dir, exist_ok=True)
    for name, data in photos.items():
        with open(os.path.join(photo_dir, name), "wb") as f:
            f.write(data)
    photos_ok = all(
        hashlib.sha256(open(os.path.join(photo_dir, n), "rb").read()).hexdigest() == h
        for n, h in manifest["photos"].items()
    )

    # the check
    tables = list(manifest["tables"])
    restored, restored_triggers = count_rows(target, tables)
    live, _ = count_rows(live_database, tables) if not args.live else (restored, None)

    print(f"\n{'table':40} {'backup':>7} {'restored':>9}   {'live now':>8}")
    all_match = True
    for table in tables:
        expected, got = manifest["tables"][table], restored[table]
        match = expected == got
        all_match &= match
        live_now = "" if live[table] is None else live[table]
        print(f"{table:40} {expected:>7} {str(got):>9} {'OK' if match else 'MISSING':>3}   {live_now:>6}")
    triggers_ok = restored_triggers == manifest["triggers"]
    print(f"{'triggers':40} {manifest['triggers']:>7} {restored_triggers:>9} {'OK' if triggers_ok else 'MISSING':>3}")
    print(f"{'photos':40} {len(photos):>7} {len(photos) if photos_ok else 'bad':>9} {'OK' if photos_ok else 'BAD':>3}")

    passed = all_match and triggers_ok and photos_ok
    print("\nRESULT:", "everything in the backup was restored" if passed else "SOMETHING IS MISSING, see above")
    if not args.live:
        print("('live now' is the real database today; it differs if data changed since the backup.)")

    if args.drop_test and not args.live:
        connection = admin_connection()
        connection.cursor().execute(f"DROP DATABASE `{TEST_DATABASE}`")
        connection.close()
        print(f"Deleted the test database {TEST_DATABASE}.")
    elif not args.live:
        print(f"The restored copy stays in the database {TEST_DATABASE} to look at. Remove it with --drop-test.")
    if args.live:
        print("Run python create_app_user.py to make sure the app's database user still has its privileges.")

    where = "the real database" if args.live else "a test database"
    log_event(
        "RESTORE",
        f"Restored {os.path.basename(path)} into {where}: {'all rows and photos match' if passed else 'MISMATCH'}",
    )
    if not passed:
        sys.exit(1)


if __name__ == "__main__":
    main()
