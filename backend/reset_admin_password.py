"""Set a new password for the dashboard's admin account (creates the account if missing).

Run:  python reset_admin_password.py
Uses ADMIN_PASSWORD from backend/.env, or asks for one if it is not set.
"""
import getpass
import os

from dotenv import load_dotenv
from database import connect
from security import hash_password

load_dotenv()


def main():
    password = os.getenv("ADMIN_PASSWORD") or getpass.getpass("New admin password: ")
    if not password:
        print("No password given.")
        return

    connection = connect(database=os.getenv("DB_NAME"), autocommit=True)
    cursor = connection.cursor()
    cursor.execute("UPDATE users SET password_hash = %s WHERE username = 'admin'", (hash_password(password),))
    if cursor.rowcount:
        print(f"Admin password updated on {os.getenv('DB_HOST')}.")
    else:
        cursor.execute(
            "INSERT INTO users (name, username, email, password_hash, role) VALUES (%s, %s, %s, %s, 'admin')",
            ("PinePal Administrator", "admin", "admin@pinepal.com", hash_password(password)),
        )
        print(f"Admin account created on {os.getenv('DB_HOST')}.")
    connection.close()


if __name__ == "__main__":
    main()
