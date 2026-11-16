"""Add users.municipality and fill it in (safe to run more than once).

- A farmer account's municipality is the same as its farm's (farmers.municipality).
  From now on the backend keeps them the same: sync_user_municipality() in farmers.py runs
  whenever a farm's municipality is set or an account is linked to a farm.
- Admins and officers have no farm. Every account is in Echague for now, so theirs is
  Echague (LOCKED_MUNICIPALITY in farmers.py), the same as the Users page form shows.

Run once:  python migrate_users_municipality.py
"""
import os

import pymysql
from dotenv import load_dotenv
from database import connect
from farmers import LOCKED_MUNICIPALITY

load_dotenv()

COPY_FROM_FARMS = """
UPDATE users u
JOIN farmers f ON f.user_id = u.id
SET u.municipality = f.municipality
WHERE u.municipality <> f.municipality
"""


def main():
    connection = connect(admin=True,
        database=os.getenv("DB_NAME"),
        autocommit=True,
        cursorclass=pymysql.cursors.DictCursor,
    )
    cursor = connection.cursor()

    cursor.execute("SHOW COLUMNS FROM users LIKE 'municipality'")
    if cursor.fetchone():
        print("users.municipality already exists")
    else:
        cursor.execute("ALTER TABLE users ADD COLUMN municipality varchar(100) NOT NULL DEFAULT '' AFTER name")
        print("Added users.municipality")

    copied = cursor.execute(COPY_FROM_FARMS)
    print(f"Copied the farm's municipality to {copied} farmer accounts")

    staff = cursor.execute(
        "UPDATE users SET municipality = %s WHERE role IN ('admin', 'officer') AND municipality = ''",
        (LOCKED_MUNICIPALITY,),
    )
    print(f"Set {staff} admin and officer accounts to {LOCKED_MUNICIPALITY}")

    cursor.close()
    connection.close()


if __name__ == "__main__":
    main()
