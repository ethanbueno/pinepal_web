"""Link every scan to its farmer with a foreign key (safe to run more than once).

mobile_scans.farmer_id -> farmers.farmer_id
  ON DELETE RESTRICT  a farmer who has scans can't be deleted, so the scans always stay.
                      Deactivate the farmer on the Farmers page instead.
  ON UPDATE CASCADE   if a farmer ID is ever changed, their scans follow it.

The key points at farmers, not users: many farmers came from the scan data and have no
login account, and a farmer's login can be removed without touching their scans.

Before adding the key this lists any scans whose farmer_id has no farmers row, and stops
without changing anything if there are some. Add those farmers first (python migrate_farmers.py
fills them from the scans).

Deploy the updated backend first, so phone sign-ups get a farmers row on their first sync.

Run once:  python migrate_mobile_scans_fk.py
"""
import os

import pymysql
from dotenv import load_dotenv
from database import connect

load_dotenv()

NAME = "fk_mobile_scans_farmer"

ORPHANS = """
SELECT s.farmer_id, COUNT(*) AS scans
FROM mobile_scans s
LEFT JOIN farmers f ON f.farmer_id = s.farmer_id
WHERE f.farmer_id IS NULL
GROUP BY s.farmer_id
ORDER BY s.farmer_id
"""


def main():
    connection = connect(admin=True,
        database=os.getenv("DB_NAME"),
        autocommit=True,
        cursorclass=pymysql.cursors.DictCursor,
    )
    cursor = connection.cursor()

    cursor.execute(
        "SELECT 1 FROM information_schema.TABLE_CONSTRAINTS "
        "WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'mobile_scans' AND CONSTRAINT_NAME = %s",
        (NAME,),
    )
    if cursor.fetchone():
        print(f"{NAME} already exists")
        connection.close()
        return

    cursor.execute(ORPHANS)
    orphans = cursor.fetchall()
    if orphans:
        print("These farmer IDs have scans but no farmers row. Nothing was changed:")
        for row in orphans:
            print(f"  {row['farmer_id']}: {row['scans']} scans")
        connection.close()
        return

    cursor.execute(
        f"ALTER TABLE mobile_scans ADD CONSTRAINT {NAME} "
        "FOREIGN KEY (farmer_id) REFERENCES farmers (farmer_id) "
        "ON DELETE RESTRICT ON UPDATE CASCADE"
    )
    print(f"Added {NAME}: every scan now belongs to a farmer, and farmers with scans can't be deleted.")

    cursor.close()
    connection.close()


if __name__ == "__main__":
    main()
