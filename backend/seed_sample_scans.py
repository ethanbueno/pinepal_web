"""Insert example scans into mobile_scans so the dashboard, map and analytics have data to show.

Run:            python seed_sample_scans.py
Remove them:    python seed_sample_scans.py --remove

Every sample has notes = 'Sample scan', so removing them never touches real scans.
Most are in Echague (the map is currently locked to it); a few are in other Isabela towns.
"""
import random
import sys
import uuid
from datetime import datetime, timedelta

from database import get_connection

TAG = "Sample scan"
COUNT = 60

# (farmer_id, farm name, municipality, farm latitude, farm longitude, how many scans out of 10)
FARMS = [
    ("F004", "Dela Cruz Farm", "Echague", 16.7050, 121.6800, 3),
    ("F011", "Soriano Pineapple Farm", "Echague", 16.7210, 121.6640, 2),
    ("F012", "Pascual Farm", "Echague", 16.6930, 121.7020, 2),
    ("F001", "Domingo Farm", "Cauayan City", 16.9300, 121.7700, 1),
    ("F003", "Reyes Farm", "Santiago City", 16.6900, 121.5500, 1),
    ("F005", "Ramos Agri Farm", "Alicia", 16.7800, 121.7000, 1),
]

# label -> weight; same labels the backend and models use
LABELS = {
    "No_Disease": 30,
    "Crown_Rot": 18,
    "Mealybug_Wilt": 20,
    "Fruit_Rot": 15,
    "Multiple_Crown": 9,
    "Fruit_Fasciation": 8,
}


def make_scan(rng, now):
    farm = rng.choices(FARMS, weights=[f[5] for f in FARMS])[0]
    farmer_id, farm_name, municipality, lat, lng, _ = farm
    labels = list(LABELS)
    predicted = rng.choices(labels, weights=list(LABELS.values()))[0]
    second = rng.choice([l for l in labels if l != predicted])

    # about 1 in 6 scans is low confidence (below 0.6), so "Needs review" has entries
    confidence = rng.uniform(0.40, 0.59) if rng.random() < 0.17 else rng.uniform(0.62, 0.99)
    second_confidence = rng.uniform(0.01, min(1 - confidence, 0.35))

    scanned_at = (now - timedelta(days=rng.randint(0, 180), hours=rng.randint(6, 17),
                                  minutes=rng.randint(0, 59))).replace(second=0, microsecond=0)

    verified_label = verified_by = verified_at = None
    if rng.random() < 0.35:
        # officers mostly agree with the model; sometimes they correct it to the second guess
        verified_label = predicted if rng.random() < 0.8 else second
        verified_by = rng.choice(["officer", "admin"])
        verified_at = scanned_at + timedelta(days=rng.randint(1, 5))
        if verified_at > now:
            verified_at = now

    return (
        str(uuid.uuid4()), farmer_id, farm_name, municipality,
        round(lat + rng.uniform(-0.008, 0.008), 7), round(lng + rng.uniform(-0.008, 0.008), 7),
        scanned_at, predicted, round(confidence, 4), second, round(second_confidence, 4),
        rng.choice(["Camera", "Camera", "Gallery"]), "",
        scanned_at + timedelta(hours=rng.randint(1, 48)),
        verified_label, verified_by, TAG, verified_at,
    )


def main():
    connection = get_connection()
    cursor = connection.cursor()

    if "--remove" in sys.argv:
        cursor.execute("DELETE FROM mobile_scans WHERE notes = %s", (TAG,))
        connection.commit()
        print(f"Removed {cursor.rowcount} sample scans.")
        connection.close()
        return

    rng = random.Random(2026)
    now = datetime.now().replace(second=0, microsecond=0)
    rows = [make_scan(rng, now) for _ in range(COUNT)]
    cursor.executemany(
        """
        INSERT INTO mobile_scans
        (scan_uuid, farmer_id, farm_name, municipality, latitude, longitude, scanned_at,
         predicted_label, confidence, second_label, second_confidence,
         image_source, image_path, synced_at, verified_label, verified_by, notes, verified_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        rows,
    )
    connection.commit()
    print(f"Inserted {cursor.rowcount} sample scans.")
    connection.close()


if __name__ == "__main__":
    main()
