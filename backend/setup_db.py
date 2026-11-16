"""Create any missing tables (never drops data), disease library and default admin account.

Run once:  python setup_db.py
"""
import os

from dotenv import load_dotenv
from database import connect
from security import set_password

load_dotenv()

# The admin password is not kept in the code. Set ADMIN_PASSWORD in backend/.env before running.
ADMIN = ("PinePal Administrator", "admin", "admin@pinepal.com", os.getenv("ADMIN_PASSWORD"))

DISEASES = [
    (
        "Black Rot",
        "Water-soaked, soft brown to black lesions at the base of the fruit.\nFruit emits a sweet fermenting odor.",
        "Avoid wounding fruit and plant material during handling.\nApply recommended fungicide and keep harvested fruit cool and dry.",
    ),
    (
        "Fruitlet Core Rot",
        "Brown to black discoloration of individual fruitlets, often only visible when the fruit is cut open.",
        "Control flower-stage infection with timely fungicide and manage insect vectors.\nRemove and destroy infected fruit.",
    ),
    (
        "Heart Rot",
        "Yellowing and wilting of central leaves, with a soft, foul-smelling rot at the base of the plant.",
        "Improve field drainage and avoid waterlogging.\nUse disease-free planting material and apply recommended fungicides.",
    ),
    (
        "Mealybug Wilt",
        "Reddening and downward curling of leaf tips, followed by wilting and stunted growth.",
        "Control mealybugs and the ants that spread them.\nUse clean planting material and remove infected plants.",
    ),
    (
        "Healthy",
        "No visible lesions, discoloration or abnormal odor.",
        "Continue regular monitoring and good field sanitation.",
    ),
]


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    connection = connect(admin=True,
        autocommit=True,
    )
    cursor = connection.cursor()

    with open(os.path.join(here, "schema.sql"), encoding="utf-8") as f:
        for statement in f.read().split(";"):
            if statement.strip():
                cursor.execute(statement)

    cursor.execute("USE " + os.getenv("DB_NAME", "pinepal_db"))

    for name, symptoms, treatment in DISEASES:
        cursor.execute(
            "INSERT IGNORE INTO diseases (name, symptoms, treatment_guide) VALUES (%s, %s, %s)",
            (name, symptoms, treatment),
        )

    name, username, email, password = ADMIN
    cursor.execute("SELECT id FROM users WHERE username = %s OR email = %s", (username, email))
    if cursor.fetchone():
        print("Admin already exists.")
    elif not password:
        print("Admin not created: set ADMIN_PASSWORD in backend/.env and run again.")
    else:
        cursor.execute(
            "INSERT INTO users (name, username, email, role) VALUES (%s, %s, %s, 'admin')",
            (name, username, email),
        )
        set_password(cursor, cursor.lastrowid, password)
        print(f"Admin created: {username} ({email})")

    connection.close()
    print("Database ready.")


if __name__ == "__main__":
    main()
