"""Remove the tables the app no longer uses (safe to run more than once).

  scans, admin_reviews                   the first version's scan and review tables. Every
                                         scan is in mobile_scans now; nothing reads these.
  mobile_scans_deleted_outside_echague   one-off copies made before two data clean-ups
  mobile_scans_municipality_backup       (scans outside Echague removed, municipalities fixed).

Afterwards the database is exactly what docs/ERD.md shows. The app login (pinepal_app) loses
its grants on these tables first, so no privilege is left pointing at a missing table.

Their rows stay in every backup made before this runs. MAKE ONE FIRST:  python backup.py
To get them back: python restore.py <that backup>  restores it into a test database, and the
rows can be copied from there.

Run once:  python migrate_drop_legacy.py     (uses the admin login, DB_ADMIN_USER)
"""
import os

import pymysql
from dotenv import load_dotenv

from database import connect

load_dotenv()

APP_USER = "pinepal_app"
# children before parents (admin_reviews points at scans)
TABLES = ["admin_reviews", "scans", "mobile_scans_deleted_outside_echague", "mobile_scans_municipality_backup"]


def main():
    database = os.getenv("DB_NAME")
    connection = connect(admin=True, database=database, autocommit=True, cursorclass=pymysql.cursors.DictCursor)
    cursor = connection.cursor()

    cursor.execute("SELECT 1 FROM mysql.user WHERE user = %s", (APP_USER,))
    app_user_exists = cursor.fetchone() is not None

    for table in TABLES:
        cursor.execute("SHOW TABLES LIKE %s", (table,))
        if not cursor.fetchone():
            print(f"{table} is already gone")
            continue
        cursor.execute(f"SELECT COUNT(*) AS n FROM `{table}`")
        rows = cursor.fetchone()["n"]
        if app_user_exists:
            cursor.execute(
                "SELECT Table_priv FROM mysql.tables_priv WHERE User = %s AND Db = %s AND Table_name = %s",
                (APP_USER, database, table),
            )
            grant = cursor.fetchone()
            if grant and grant["Table_priv"]:
                cursor.execute(f"REVOKE {grant['Table_priv'].upper()} ON `{database}`.`{table}` FROM '{APP_USER}'@'%'")
        cursor.execute(f"DROP TABLE `{table}`")
        print(f"Dropped {table} ({rows} rows; they are in your earlier backups)")

    cursor.close()
    connection.close()


if __name__ == "__main__":
    main()
