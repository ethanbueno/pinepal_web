"""Create the app's own database user, with only the privileges it needs (least privilege).

The API should not connect as the database's admin account (avnadmin on Aiven), which can
drop tables, remove the audit triggers and create logins. This makes pinepal_app instead:

  users, user_credentials, farmers, mobile_scans,  SELECT, INSERT, UPDATE, DELETE
  login_history, diseases                          (read and write rows: DML only)
  audit_logs                                       SELECT, INSERT (add and read, never
                                                   change or delete)

and nothing else: no CREATE, ALTER, DROP, TRIGGER, CREATE USER or GRANT, and no access to
other databases or the old backup tables. Tables, triggers and migrations stay with the
admin account (DB_ADMIN_USER in .env, used by setup_db.py and the migrate_*.py scripts).

Run it with the admin account in .env:  python create_app_user.py
  - The first time, it creates pinepal_app with a random password and rewrites .env:
    DB_USER / DB_PASSWORD become pinepal_app's, and the admin login moves to
    DB_ADMIN_USER / DB_ADMIN_PASSWORD.
  - Later runs only set the privileges again. Run it after a migration adds a table the
    app needs, and add that table to APP_TABLES.
  - python create_app_user.py --new-password  gives it a new password and saves it in .env
    (anyone else using the old one then needs the new one).
"""
import os
import re
import secrets
import sys

from dotenv import load_dotenv

from database import connect

ENV_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(ENV_FILE, override=True)

APP_USER = "pinepal_app"
APP_TABLES = [
    "users", "user_credentials", "farmers", "mobile_scans", "login_history", "diseases",
    "password_resets",
]
APPEND_ONLY_TABLES = ["audit_logs"]
# kept up to date by triggers only (migrate_optimization.py); the app just reads them
READ_ONLY_TABLES = ["scan_daily_stats"]


def set_env(values):
    """Change or add KEY=value lines in .env, keeping everything else as it is."""
    with open(ENV_FILE, encoding="utf-8") as f:
        text = f.read()
    for key, value in values.items():
        line = f"{key}={value}"
        pattern = re.compile(rf"^{re.escape(key)}=.*$", re.MULTILINE)
        if pattern.search(text):
            text = pattern.sub(lambda _: line, text)
        else:
            text = text.rstrip("\n") + "\n" + line + "\n"
    with open(ENV_FILE, "w", encoding="utf-8") as f:
        f.write(text)


def main():
    database = os.getenv("DB_NAME")
    if os.getenv("DB_USER") == APP_USER and not os.getenv("DB_ADMIN_USER"):
        raise SystemExit("Set DB_ADMIN_USER and DB_ADMIN_PASSWORD in .env to the admin login first.")

    connection = connect(admin=True, autocommit=True)
    cursor = connection.cursor()
    account = f"'{APP_USER}'@'%'"

    cursor.execute("SELECT 1 FROM mysql.user WHERE user = %s", (APP_USER,))
    exists = cursor.fetchone() is not None
    # letters, digits, - and _, plus one of each kind for password rules
    password = secrets.token_urlsafe(32) + "-Aa9"
    require = " REQUIRE SSL" if os.getenv("DB_SSL_CA") else ""
    # %% because these queries have a parameter: it becomes the host wildcard '%'
    if not exists:
        cursor.execute(f"CREATE USER '{APP_USER}'@'%%' IDENTIFIED BY %s{require}", (password,))
        print(f"Created {APP_USER}")
    elif "--new-password" in sys.argv:
        cursor.execute(f"ALTER USER '{APP_USER}'@'%%' IDENTIFIED BY %s{require}", (password,))
        print(f"Gave {APP_USER} a new password")
    else:
        password = None
        print(f"{APP_USER} already exists, setting its privileges again")

    if password:
        # saved straight away, so a failure below can't lose it
        if os.getenv("DB_USER") != APP_USER:
            set_env({
                "DB_ADMIN_USER": os.getenv("DB_USER"),
                "DB_ADMIN_PASSWORD": os.getenv("DB_PASSWORD"),
            })
        set_env({"DB_USER": APP_USER, "DB_PASSWORD": password})
        print(f".env now uses {APP_USER}; the admin login is DB_ADMIN_USER / DB_ADMIN_PASSWORD")

    # Start from nothing, so the list below is exactly what it can do. Each grant it has is
    # taken back one by one (Aiven refuses a blanket REVOKE ALL because of its system databases).
    cursor.execute(f"SHOW GRANTS FOR {account}")
    for (grant,) in cursor.fetchall():
        match = re.match(r"GRANT (.+) ON (\S+) TO ", grant)
        if match and match.group(1) != "USAGE":
            cursor.execute(f"REVOKE {match.group(1)} ON {match.group(2)} FROM {account}")
    for table in APP_TABLES:
        cursor.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON `{database}`.`{table}` TO {account}")
    for table in APPEND_ONLY_TABLES:
        cursor.execute(f"GRANT SELECT, INSERT ON `{database}`.`{table}` TO {account}")
    for table in READ_ONLY_TABLES:
        cursor.execute(f"SHOW TABLES FROM `{database}` LIKE %s", (table,))
        if cursor.fetchone():  # made by migrate_optimization.py
            cursor.execute(f"GRANT SELECT ON `{database}`.`{table}` TO {account}")

    cursor.execute(f"SHOW GRANTS FOR {account}")
    for row in cursor.fetchall():
        print(" ", row[0])
    cursor.close()
    connection.close()

    if not password and os.getenv("DB_USER") != APP_USER:
        print(f"To use it, put DB_USER={APP_USER} and its password in .env (ask whoever created "
              "it, or run this with --new-password), and move the admin login to "
              "DB_ADMIN_USER / DB_ADMIN_PASSWORD.")


if __name__ == "__main__":
    main()
