"""Copy the scans from your local XAMPP MySQL into the Aiven database's mobile_scans table.

Run (with XAMPP's MySQL started):  python import_mobile_scans.py

- Reads from local MySQL using the settings in backend/.env.xampp:
    db_bueno.scans            (the mobile app's scans)
    pinepal_db.mobile_scans   (the copy the dashboard used, incl. web scans and verifications)
- Writes into mobile_scans on the database in backend/.env (Aiven).
- Safe to re-run: scans already on Aiven are skipped (scan_uuid is the primary key).
- Never changes the local databases.
"""
import os

import pymysql
from dotenv import dotenv_values
from database import connect

HERE = os.path.dirname(os.path.abspath(__file__))
LOCAL = dotenv_values(os.path.join(HERE, ".env.xampp"))
LOCAL_DB = LOCAL.get("DB_NAME") or "pinepal_db"
MOBILE_DB = "db_bueno"

COLS = [
    "scan_uuid", "farmer_id", "farm_name", "municipality", "latitude", "longitude", "scanned_at",
    "predicted_label", "confidence", "second_label", "second_confidence", "image_source",
    "image_path", "synced_at", "verified_label", "verified_by", "notes", "verified_at",
]


def read_local(cursor, table):
    """All scans in a local table, or [] when the table doesn't exist."""
    db, name = table.split(".")
    cursor.execute(
        "SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s",
        (db, name),
    )
    available = {r["c"] for r in cursor.fetchall()}
    if not available:
        print(f"  {table}: not found, skipped")
        return []
    # db_bueno.scans has no verified_at; fill it with NULL
    select = ", ".join(c if c in available else f"NULL AS {c}" for c in COLS)
    cursor.execute(f"SELECT {select} FROM {table}")
    rows = cursor.fetchall()
    print(f"  {table}: {len(rows)} scans")
    return rows


def main():
    try:
        local = connect(
            host=LOCAL.get("DB_HOST") or "localhost",
            port=int(LOCAL.get("DB_PORT") or 3306),
            user=LOCAL.get("DB_USER") or "root",
            password=LOCAL.get("DB_PASSWORD") or "",
            ssl=None,
            cursorclass=pymysql.cursors.DictCursor,
        )
    except pymysql.err.OperationalError as e:
        print(f"Could not connect to local MySQL ({e.args[1]}). Start MySQL in XAMPP and run again.")
        return

    print("Reading local scans:")
    cursor = local.cursor()
    # pinepal_db.mobile_scans first: its copies carry the web verifications
    rows = read_local(cursor, f"{LOCAL_DB}.mobile_scans") + read_local(cursor, f"{MOBILE_DB}.scans")
    local.close()

    if not rows:
        print("Nothing to copy.")
        return

    aiven = connect(database=os.getenv("DB_NAME"))
    cursor = aiven.cursor()
    cursor.executemany(
        f"INSERT IGNORE INTO mobile_scans ({', '.join(COLS)}) VALUES ({', '.join(['%s'] * len(COLS))})",
        [tuple(r[c] for c in COLS) for r in rows],
    )
    inserted = cursor.rowcount
    aiven.commit()
    cursor.execute("SELECT COUNT(*) FROM mobile_scans")
    total = cursor.fetchone()[0]
    aiven.close()

    print(f"Copied {inserted} new scans to {os.getenv('DB_HOST')}. mobile_scans now has {total} rows.")


if __name__ == "__main__":
    main()
