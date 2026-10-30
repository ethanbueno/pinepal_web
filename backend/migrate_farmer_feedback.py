"""Add the farmer's feedback columns to mobile_scans (safe to run more than once).

The mobile app lets a farmer say whether the model's result was right. That is kept apart
from verified_label, which only an officer sets on the web and which counts as ground truth.

- farmer_feedback: 'correct' or 'incorrect' (empty until the farmer answers)
- farmer_label:    the disease the farmer says it actually is (empty when unsure)

Run once:  python migrate_farmer_feedback.py
"""
import os

import pymysql
from dotenv import load_dotenv
from database import connect

load_dotenv()

COLUMNS = [
    ("farmer_feedback", "varchar(10) DEFAULT NULL"),
    ("farmer_label", "varchar(50) DEFAULT NULL"),
]


def main():
    connection = connect(
        database=os.getenv("DB_NAME"),
        autocommit=True,
        cursorclass=pymysql.cursors.DictCursor,
    )
    cursor = connection.cursor()

    for name, definition in COLUMNS:
        cursor.execute("SHOW COLUMNS FROM mobile_scans LIKE %s", (name,))
        if cursor.fetchone():
            print(f"mobile_scans.{name} already exists")
        else:
            cursor.execute(f"ALTER TABLE mobile_scans ADD COLUMN {name} {definition}")
            print(f"Added mobile_scans.{name}")

    cursor.close()
    connection.close()


if __name__ == "__main__":
    main()
