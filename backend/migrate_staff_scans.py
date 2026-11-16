"""Let admins and officers save a scan without choosing a farmer (safe to run more than once).

- mobile_scans.farmer_id may be empty: a scan staff saved on the web Diagnose page for no
  particular farmer. Every scan from a farmer still has its farmer ID.
- mobile_scans.saved_by / saved_by_name: the staff account that saved such a scan, so it
  shows as "<name> (staff)". Deleting that account keeps the scan (saved_by is cleared).
Existing scans are not changed.

Run once:  python migrate_staff_scans.py
"""
import os

import pymysql
from dotenv import load_dotenv
from database import connect

load_dotenv()


def main():
    connection = connect(admin=True,
        database=os.getenv("DB_NAME"),
        autocommit=True,
        cursorclass=pymysql.cursors.DictCursor,
    )
    cursor = connection.cursor()

    cursor.execute("SHOW COLUMNS FROM mobile_scans LIKE 'farmer_id'")
    if cursor.fetchone()["Null"] == "YES":
        print("mobile_scans.farmer_id can already be empty")
    else:
        # the column is in a foreign key, so the key comes off while the column changes
        cursor.execute("ALTER TABLE mobile_scans DROP FOREIGN KEY fk_mobile_scans_farmer")
        cursor.execute("ALTER TABLE mobile_scans MODIFY farmer_id varchar(50) NULL")
        cursor.execute(
            "ALTER TABLE mobile_scans ADD CONSTRAINT fk_mobile_scans_farmer FOREIGN KEY (farmer_id) "
            "REFERENCES farmers (farmer_id) ON DELETE RESTRICT ON UPDATE CASCADE"
        )
        print("mobile_scans.farmer_id can now be empty (staff scans)")

    cursor.execute("SHOW COLUMNS FROM mobile_scans LIKE 'saved_by'")
    if cursor.fetchone():
        print("mobile_scans.saved_by already exists")
    else:
        cursor.execute(
            "ALTER TABLE mobile_scans ADD COLUMN saved_by int(11) DEFAULT NULL AFTER farmer_id, "
            "ADD COLUMN saved_by_name varchar(100) DEFAULT NULL AFTER saved_by"
        )
        cursor.execute(
            "ALTER TABLE mobile_scans ADD CONSTRAINT fk_mobile_scans_saved_by FOREIGN KEY (saved_by) "
            "REFERENCES users (id) ON DELETE SET NULL"
        )
        print("Added mobile_scans.saved_by and saved_by_name")

    cursor.close()
    connection.close()


if __name__ == "__main__":
    main()
