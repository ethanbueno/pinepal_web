"""Add the login_history table (safe to run more than once).

Every sign-in attempt on the web and the mobile app is saved there (login_history.py),
and admins see it in the Login history drawer. Deleting an account keeps its history,
with user_id cleared.

Run once:  python migrate_login_history.py
"""
import os

import pymysql
from dotenv import load_dotenv
from database import connect

load_dotenv()

CREATE = """
CREATE TABLE IF NOT EXISTS login_history (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) DEFAULT NULL,
  username varchar(150) NOT NULL,
  success tinyint(1) NOT NULL,
  reason varchar(30) DEFAULT NULL,
  platform enum('web','mobile') NOT NULL,
  ip_address varchar(45) DEFAULT NULL,
  user_agent varchar(255) DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY idx_login_history_created (created_at),
  KEY idx_login_history_user (user_id),
  CONSTRAINT fk_login_history_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
"""


def main():
    connection = connect(
        database=os.getenv("DB_NAME"),
        autocommit=True,
        cursorclass=pymysql.cursors.DictCursor,
    )
    cursor = connection.cursor()
    cursor.execute("SHOW TABLES LIKE 'login_history'")
    if cursor.fetchone():
        print("login_history already exists")
    else:
        cursor.execute(CREATE)
        print("Added the login_history table")
    cursor.close()
    connection.close()


if __name__ == "__main__":
    main()
