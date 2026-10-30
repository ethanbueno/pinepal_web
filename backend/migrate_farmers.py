"""Create the farmers table and fill it from the scans (safe to run more than once).

The mobile app's scans carry a farmer ID (F001, F002, ...) and a farm name and municipality,
but there is no list of farmers anywhere. This creates one so the Farmers pages and
"Save as scan" have real data to work with.

- farmers.farmer_id is the same ID the scans use. A farmer's login username is their farmer ID,
  so scans uploaded from the phone (stored under the username) and the Farmers pages line up.
- Seeded from the real scans only: IDs that look like F001 and scans not marked 'Sample scan'.
- The data has no personal names, so full_name starts as "Farmer F001". Edit it on the Farmers page.
- farm_latitude / farm_longitude start as the average of the farmer's scan locations (approximate).

Run once:  python migrate_farmers.py
"""
import os

from dotenv import load_dotenv
from database import connect

load_dotenv()

CREATE = """
CREATE TABLE IF NOT EXISTS farmers (
  farmer_id varchar(50) NOT NULL,
  full_name varchar(100) NOT NULL,
  farm_name varchar(150) NOT NULL,
  municipality varchar(100) NOT NULL,
  farm_latitude decimal(10,7) NOT NULL,
  farm_longitude decimal(10,7) NOT NULL,
  farm_size_ha decimal(6,2) DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  registered_at datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (farmer_id),
  KEY idx_farmers_municipality (municipality)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
"""

SEED = """
INSERT IGNORE INTO farmers (farmer_id, full_name, farm_name, municipality, farm_latitude, farm_longitude)
SELECT farmer_id,
       CONCAT('Farmer ', farmer_id),
       MIN(farm_name),
       MIN(municipality),
       ROUND(AVG(latitude), 7),
       ROUND(AVG(longitude), 7)
FROM mobile_scans
WHERE farmer_id REGEXP '^F[0-9]+$'
  AND (notes IS NULL OR notes <> 'Sample scan')
  AND farm_name IS NOT NULL AND farm_name <> ''
  AND municipality IS NOT NULL AND municipality <> ''
GROUP BY farmer_id
"""


def main():
    connection = connect(database=os.getenv("DB_NAME", "pinepal_db"), autocommit=False)
    cursor = connection.cursor()

    cursor.execute(CREATE)
    cursor.execute("SELECT COUNT(*) FROM farmers")
    before = cursor.fetchone()[0]

    cursor.execute(SEED)
    connection.commit()

    cursor.execute("SELECT COUNT(*) FROM farmers")
    after = cursor.fetchone()[0]
    connection.close()

    print(f"farmers table ready: {before} -> {after} farmers ({after - before} added from the scans).")


if __name__ == "__main__":
    main()
