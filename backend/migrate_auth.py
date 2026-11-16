"""Upgrade the users table for the web dashboard (safe to run more than once).

- adds a unique `username` column (filled from the email for existing accounts)
- email becomes optional
- roles become admin / officer / farmer (old 'user' accounts become 'farmer')

Run once:  python migrate_auth.py
"""
import os

import pymysql
from dotenv import load_dotenv
from database import connect

load_dotenv()


def column_exists(cursor, name):
    cursor.execute("SHOW COLUMNS FROM users LIKE %s", (name,))
    return cursor.fetchone() is not None


def main():
    connection = connect(admin=True,
        database=os.getenv("DB_NAME"),
        autocommit=True,
        cursorclass=pymysql.cursors.DictCursor,
    )
    cursor = connection.cursor()

    # 1. username column
    if not column_exists(cursor, "username"):
        cursor.execute("ALTER TABLE users ADD COLUMN username varchar(50) NULL AFTER email")
        print("Added users.username")

    # 2. fill username for accounts that don't have one (email part before the @)
    cursor.execute("SELECT id, email FROM users WHERE username IS NULL")
    for row in cursor.fetchall():
        base = (row["email"] or "user").split("@")[0].lower()
        cursor.execute("SELECT id FROM users WHERE username = %s", (base,))
        username = base if cursor.fetchone() is None else f"{base}{row['id']}"
        cursor.execute("UPDATE users SET username = %s WHERE id = %s", (username, row["id"]))
        print(f"  user {row['id']} -> username '{username}'")

    cursor.execute("SHOW INDEX FROM users WHERE Key_name = 'username'")
    if cursor.fetchone() is None:
        cursor.execute("ALTER TABLE users ADD UNIQUE KEY username (username)")
    cursor.execute("ALTER TABLE users MODIFY username varchar(50) NOT NULL")

    # 3. email is optional now (web sign-up uses a username)
    cursor.execute("ALTER TABLE users MODIFY email varchar(150) NULL")

    # 4. roles: admin / officer / farmer
    cursor.execute(
        "ALTER TABLE users MODIFY role enum('user','admin','officer','farmer') NOT NULL DEFAULT 'farmer'"
    )
    cursor.execute("UPDATE users SET role = 'farmer' WHERE role = 'user'")
    cursor.execute(
        "ALTER TABLE users MODIFY role enum('admin','officer','farmer') NOT NULL DEFAULT 'farmer'"
    )

    connection.close()
    print("users table is ready.")


if __name__ == "__main__":
    main()
