"""Add users.avatar_url and users.cover_url for profile and cover photos (safe to run more
than once, and on the live database: both columns are NULL-able, so MySQL adds them without
rewriting or locking the table, and no existing row changes).

Run it BEFORE deploying the backend that reads these columns (my_profile.py):
    python migrate_profile_photos.py
"""
import os

import pymysql
from dotenv import load_dotenv

from database import connect

load_dotenv()

COLUMNS = [
    ("avatar_url", "ALTER TABLE users ADD COLUMN avatar_url varchar(500) NULL AFTER municipality"),
    ("cover_url", "ALTER TABLE users ADD COLUMN cover_url varchar(500) NULL AFTER avatar_url"),
]


def main():
    connection = connect(admin=True,
        database=os.getenv("DB_NAME"),
        autocommit=True,
        cursorclass=pymysql.cursors.DictCursor,
    )
    cursor = connection.cursor()
    for column, statement in COLUMNS:
        cursor.execute("SHOW COLUMNS FROM users LIKE %s", (column,))
        if cursor.fetchone():
            print(f"users.{column} already exists")
        else:
            cursor.execute(statement)
            print(f"Added users.{column}")
    cursor.close()
    connection.close()


if __name__ == "__main__":
    main()
