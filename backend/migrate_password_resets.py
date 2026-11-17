"""Add the password_resets table for Forgot password (safe to run more than once).

One row per emailed reset code (password_reset.py). Only a bcrypt hash of the code is
kept. A code is done when used_at is set: used, replaced by a newer code, or too many wrong
tries. Deleting an account deletes its codes.

Run once:  python migrate_password_resets.py     (uses the admin login, DB_ADMIN_USER)
Then:      python create_app_user.py              (gives the app access to the table)
"""
import os

import pymysql
from dotenv import load_dotenv

from database import connect

load_dotenv()

CREATE = """
CREATE TABLE IF NOT EXISTS password_resets (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  code_hash varchar(255) NOT NULL,
  attempts tinyint NOT NULL DEFAULT 0,
  expires_at datetime NOT NULL,
  used_at datetime DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY idx_password_resets_user (user_id, created_at),
  CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_password_resets_bcrypt CHECK (code_hash LIKE '$2_$%'),
  CONSTRAINT chk_password_resets_attempts CHECK (attempts BETWEEN 0 AND 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
"""


def main():
    connection = connect(admin=True, database=os.getenv("DB_NAME"), autocommit=True,
                         cursorclass=pymysql.cursors.DictCursor)
    cursor = connection.cursor()
    cursor.execute("SET SESSION lock_wait_timeout = 10, SESSION wait_timeout = 120")
    cursor.execute("SHOW TABLES LIKE 'password_resets'")
    if cursor.fetchone():
        print("password_resets already exists")
    else:
        cursor.execute(CREATE)
        print("Added the password_resets table")
    cursor.close()
    connection.close()
    print("Now run: python create_app_user.py")


if __name__ == "__main__":
    main()
