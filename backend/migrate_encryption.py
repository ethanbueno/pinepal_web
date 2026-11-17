"""Make room for encrypted IP addresses, and encrypt the ones already saved (safe to run more than once).

The API now saves IP addresses encrypted (encryption.py). An encrypted IP is about 100 to 140
characters, so login_history.ip_address and audit_logs.ip_address grow from varchar(45) to
varchar(255). Run this BEFORE starting the updated backend: an encrypted IP doesn't fit the
old columns.

It also encrypts the IP addresses already in login_history. Older audit_logs rows are left as
they were written: the audit log is append-only (its triggers refuse UPDATE), and the
Audit logs page shows both kinds.

Needs DATA_ENCRYPTION_KEY in .env (python encryption.py makes one).

Run once:  python migrate_encryption.py     (uses the admin login, DB_ADMIN_USER)
"""
import os

import pymysql
from dotenv import load_dotenv

from database import connect
from encryption import TOKEN_PREFIX, encrypt_text, require_cipher

load_dotenv()

COLUMNS = [("login_history", "ip_address"), ("audit_logs", "ip_address")]
WIDTH = 255


def main():
    require_cipher()
    connection = connect(
        admin=True,
        database=os.getenv("DB_NAME"),
        autocommit=False,
        cursorclass=pymysql.cursors.DictCursor,
    )
    cursor = connection.cursor()

    for table, column in COLUMNS:
        cursor.execute(
            "SELECT CHARACTER_MAXIMUM_LENGTH AS width FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s",
            (table, column),
        )
        if cursor.fetchone()["width"] >= WIDTH:
            print(f"{table}.{column} is already varchar({WIDTH})")
        else:
            cursor.execute(f"ALTER TABLE `{table}` MODIFY `{column}` varchar({WIDTH}) DEFAULT NULL")
            print(f"{table}.{column} is now varchar({WIDTH})")

    # login_history rows saved before encryption: encrypt them in one transaction
    cursor.execute(
        "SELECT id, ip_address FROM login_history "
        "WHERE ip_address IS NOT NULL AND ip_address <> '' AND ip_address NOT LIKE %s",
        (TOKEN_PREFIX + "%",),
    )
    rows = cursor.fetchall()
    try:
        for row in rows:
            cursor.execute(
                "UPDATE login_history SET ip_address = %s WHERE id = %s",
                (encrypt_text(row["ip_address"]), row["id"]),
            )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    print(f"Encrypted {len(rows)} IP addresses already in login_history")

    cursor.execute("SELECT COUNT(*) AS n FROM audit_logs WHERE ip_address LIKE %s", (TOKEN_PREFIX + "%",))
    print(f"audit_logs: {cursor.fetchone()['n']} rows with an encrypted IP so far (older rows stay as written)")

    cursor.close()
    connection.close()


if __name__ == "__main__":
    main()
