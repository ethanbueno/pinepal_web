"""Link each farmer account to its row in farmers (safe to run more than once).

- farmers.user_id -> users.id, unique: one farmers row per farmer account. Sign up and the
  Farmers page fill it, and the mobile sync finds the farmer's row through it.
  Farmers that came from the scan data have no login yet, so it stays empty for them
  until staff create one on the Farmers page.
- The farm details can be blank now (a farmer who signs up has not entered them yet).
  The first sync from the phone fills them in, and staff can edit them.
- Links the rows that already match (username = farmer_id), then adds a row for every
  farmer account that still has none, under the next farmer ID.
- Farmer IDs look like F001 and never change. Rows that were given the username as their
  farmer ID get a proper one once; their scans follow (ON UPDATE CASCADE).

Run once:  python migrate_farmer_accounts.py
"""
import os

import pymysql
from dotenv import load_dotenv
from database import connect
from farmers import add_farmer

load_dotenv()

NEXT_ID = "SELECT MAX(CAST(SUBSTRING(farmer_id, 2) AS UNSIGNED)) AS last FROM farmers WHERE farmer_id REGEXP '^F[0-9]+$'"

BLANK_FARM = [
    "MODIFY farm_name varchar(150) NOT NULL DEFAULT ''",
    "MODIFY municipality varchar(100) NOT NULL DEFAULT ''",
    "MODIFY farm_latitude decimal(10,7) DEFAULT NULL",
    "MODIFY farm_longitude decimal(10,7) DEFAULT NULL",
]

LINK_EXISTING = """
UPDATE farmers f
JOIN users u ON u.username = f.farmer_id AND u.role = 'farmer'
SET f.user_id = u.id
WHERE f.user_id IS NULL
"""

MISSING = """
SELECT u.id, u.username, u.name
FROM users u
LEFT JOIN farmers f ON f.user_id = u.id
WHERE u.role = 'farmer' AND f.farmer_id IS NULL
"""


def main():
    connection = connect(admin=True,
        database=os.getenv("DB_NAME"),
        autocommit=True,
        cursorclass=pymysql.cursors.DictCursor,
    )
    cursor = connection.cursor()

    cursor.execute("SHOW COLUMNS FROM farmers LIKE 'user_id'")
    if cursor.fetchone():
        print("farmers.user_id already exists")
    else:
        cursor.execute("ALTER TABLE farmers ADD COLUMN user_id int(11) DEFAULT NULL AFTER farmer_id")
        cursor.execute("ALTER TABLE farmers ADD UNIQUE KEY uq_farmers_user (user_id)")
        cursor.execute(
            "ALTER TABLE farmers ADD CONSTRAINT fk_farmers_user FOREIGN KEY (user_id) "
            "REFERENCES users (id) ON DELETE SET NULL"
        )
        print("Added farmers.user_id")

    cursor.execute("ALTER TABLE farmers " + ", ".join(BLANK_FARM))
    print("Farm details can now start blank")

    linked = cursor.execute(LINK_EXISTING)
    print(f"Linked {linked} farmers to their existing account")

    cursor.execute(MISSING)
    for user in cursor.fetchall():
        farmer_id = add_farmer(cursor, user["id"], user["name"])
        print(f"  added farmer {farmer_id} for {user['username']}")

    cursor.execute("SELECT farmer_id FROM farmers WHERE farmer_id NOT REGEXP '^F[0-9]+$' ORDER BY registered_at")
    for row in cursor.fetchall():
        cursor.execute(NEXT_ID)
        new_id = f"F{(cursor.fetchone()['last'] or 0) + 1:03d}"
        cursor.execute("UPDATE farmers SET farmer_id = %s WHERE farmer_id = %s", (new_id, row["farmer_id"]))
        print(f"  farmer ID {row['farmer_id']} -> {new_id} (its scans moved with it)")

    cursor.close()
    connection.close()


if __name__ == "__main__":
    main()
