"""Add the app_settings table (safe to run more than once).

Key/value settings admins change from the web (app_settings.py), for now the mobile app's
download link. Afterwards run python create_app_user.py so the app's login can use it.

Run once:  python migrate_app_settings.py
"""
import os

from dotenv import load_dotenv
from database import connect

load_dotenv()

CREATE = """
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key varchar(64) NOT NULL,
  setting_value text DEFAULT NULL,
  updated_by int(11) DEFAULT NULL,
  updated_at datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (setting_key),
  KEY fk_app_settings_user (updated_by),
  CONSTRAINT fk_app_settings_user FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
"""


def main():
    connection = connect(admin=True, database=os.getenv("DB_NAME"), autocommit=True)
    cursor = connection.cursor()
    cursor.execute("SHOW TABLES LIKE 'app_settings'")
    if cursor.fetchone():
        print("app_settings already exists")
    else:
        cursor.execute(CREATE)
        print("Added the app_settings table")
    cursor.close()
    connection.close()


if __name__ == "__main__":
    main()
