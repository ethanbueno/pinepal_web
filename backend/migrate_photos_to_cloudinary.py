"""Move scan photos that are still in backend/uploads to Cloudinary (safe to run more than once).

For every mobile_scans row whose image_path is a local file name (<scan_uuid>.jpg / .png) and
whose file is in uploads/, upload the file to Cloudinary (folder pinepal/scans) and set
image_path to its https URL. Rows already on http(s), rows without a photo, and rows whose file
is missing here are skipped. The local files are left in place.

Needs CLOUDINARY_URL in backend/.env (see photo_storage.py) and runs against DB_NAME with the
app login, like the API. Run it on the machine that has the photos in uploads/.

Try first:  python migrate_photos_to_cloudinary.py --dry-run
Then:       python migrate_photos_to_cloudinary.py
"""
import argparse
import os
import sys
import uuid

import pymysql
from dotenv import load_dotenv

load_dotenv(override=True)

import cloudinary.uploader  # noqa: E402

from database import connect  # noqa: E402
from photo_storage import CLOUDINARY_FOLDER, LOCAL_PHOTO, UPLOAD_DIR, is_remote, using_cloudinary  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="only count what would be uploaded")
    args = parser.parse_args()

    if not args.dry_run and not using_cloudinary():
        sys.exit("CLOUDINARY_URL is not set in backend/.env")

    connection = connect(database=os.getenv("DB_NAME"), cursorclass=pymysql.cursors.DictCursor)
    cursor = connection.cursor()
    cursor.execute("SELECT scan_uuid, image_path FROM mobile_scans WHERE image_path <> ''")
    rows = cursor.fetchall()

    counts = {"already on Cloudinary": 0, "not a server photo": 0, "file missing": 0,
              "to upload" if args.dry_run else "uploaded": 0, "failed": 0}
    for row in rows:
        stored = row["image_path"]
        if is_remote(stored):
            counts["already on Cloudinary"] += 1
            continue
        if not LOCAL_PHOTO.fullmatch(stored):
            counts["not a server photo"] += 1  # an old path on the phone
            continue
        path = os.path.join(UPLOAD_DIR, stored)
        if not os.path.isfile(path):
            counts["file missing"] += 1
            print(f"  missing: {stored}")
            continue
        if args.dry_run:
            counts["to upload"] += 1
            continue

        try:
            result = cloudinary.uploader.upload(
                path, folder=CLOUDINARY_FOLDER, public_id=uuid.uuid4().hex,
                resource_type="image", overwrite=False,
            )
            url = result["secure_url"]
            # only if the row still has the local photo, so a newer sync is not overwritten
            cursor.execute(
                "UPDATE mobile_scans SET image_path = %s WHERE scan_uuid = %s AND image_path = %s",
                (url, row["scan_uuid"], stored),
            )
            connection.commit()
            counts["uploaded"] += 1
        except Exception as error:
            connection.rollback()
            counts["failed"] += 1
            print(f"  failed: {stored} ({type(error).__name__}: {error})")

    cursor.close()
    connection.close()

    print(f"Rows with a photo value: {len(rows)}" + ("  (dry run, nothing changed)" if args.dry_run else ""))
    for label, count in counts.items():
        print(f"  {label}: {count}")


if __name__ == "__main__":
    main()
