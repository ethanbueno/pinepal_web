"""Copy the mobile app's scans from db_bueno.scans into pinepal_db.mobile_scans.

Run:  python import_mobile_scans.py

- Creates pinepal_db.mobile_scans with the same structure as db_bueno.scans.
- Safe to re-run: existing rows are skipped (scan_uuid is the primary key).
- Only reads from db_bueno; never changes it or pinepal_db's other tables.
"""
import os

import pymysql
from dotenv import load_dotenv

load_dotenv()

SOURCE_DB = "db_bueno"
TARGET_DB = os.getenv("DB_NAME", "pinepal_db")

# the columns the mobile app's table has (the web copy also has verified_at)
COLS = (
    "scan_uuid, farmer_id, farm_name, municipality, latitude, longitude, scanned_at, "
    "predicted_label, confidence, second_label, second_confidence, image_source, "
    "image_path, synced_at, verified_label, verified_by, notes"
)


def main():
    connection = pymysql.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        autocommit=False,
    )
    cursor = connection.cursor()

    cursor.execute(f"CREATE TABLE IF NOT EXISTS `{TARGET_DB}`.mobile_scans LIKE `{SOURCE_DB}`.scans")
    # The web app also saves scans (image_source "Web") and records when a scan was verified.
    cursor.execute(f"SHOW COLUMNS FROM `{TARGET_DB}`.mobile_scans LIKE 'verified_at'")
    if not cursor.fetchone():
        cursor.execute(f"ALTER TABLE `{TARGET_DB}`.mobile_scans ADD COLUMN verified_at datetime DEFAULT NULL")
    cursor.execute(
        f"ALTER TABLE `{TARGET_DB}`.mobile_scans "
        "MODIFY image_source enum('Camera','Gallery','Web') NOT NULL"
    )
    cursor.execute(f"INSERT IGNORE INTO `{TARGET_DB}`.mobile_scans ({COLS}) SELECT {COLS} FROM `{SOURCE_DB}`.scans")
    inserted = cursor.rowcount
    connection.commit()

    cursor.execute(f"SELECT COUNT(*) FROM `{SOURCE_DB}`.scans")
    source_total = cursor.fetchone()[0]
    cursor.execute(f"SELECT COUNT(*) FROM `{TARGET_DB}`.mobile_scans")
    target_total = cursor.fetchone()[0]
    connection.close()

    print(f"Inserted {inserted} new scans.")
    print(f"{SOURCE_DB}.scans: {source_total} rows -> {TARGET_DB}.mobile_scans: {target_total} rows")


if __name__ == "__main__":
    main()
