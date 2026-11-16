"""Set a new password for the dashboard's admin account (creates the account if missing).

Run:  python reset_admin_password.py
Uses ADMIN_PASSWORD from backend/.env, or asks for one if it is not set.
"""
import getpass
import os

from dotenv import load_dotenv
from database import connect
from security import set_password

load_dotenv()


def main():
    password = os.getenv("ADMIN_PASSWORD") or getpass.getpass("New admin password: ")
    if not password:
        print("No password given.")
        return

    connection = connect(database=os.getenv("DB_NAME"), autocommit=True)
    cursor = connection.cursor()
    cursor.execute("SELECT id FROM users WHERE username = 'admin'")
    admin = cursor.fetchone()
    if admin:
        set_password(cursor, admin[0], password)
        print(f"Admin password updated on {os.getenv('DB_HOST')}.")
    else:
        cursor.execute(
            "INSERT INTO users (name, username, email, role) VALUES (%s, %s, %s, 'admin')",
            ("PinePal Administrator", "admin", "admin@pinepal.com"),
        )
        set_password(cursor, cursor.lastrowid, password)
        print(f"Admin account created on {os.getenv('DB_HOST')}.")
    connection.close()


if __name__ == "__main__":
    main()
