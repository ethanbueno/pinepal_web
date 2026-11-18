"""Where scan photos are kept: Cloudinary when CLOUDINARY_URL is set, otherwise backend/uploads.

Render's disk is wiped on every restart and deploy, so on Render the photos go to Cloudinary
and mobile_scans.image_path holds the full https URL. Without CLOUDINARY_URL (local XAMPP)
they are saved in uploads/ as <scan_uuid>.jpg / .png, as before, and image_path holds that
file name. Rows from before either still work: old local file names are served by the
/uploads route (scans.py), and older rows holding a path on the phone stay without a photo.

CLOUDINARY_URL looks like cloudinary://<api_key>:<api_secret>@<cloud_name>. Keep it in
backend/.env and in Render's environment, never in git. The SDK reads it by itself.
"""
import os
import re
import uuid
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv(override=True)  # before importing cloudinary, which reads CLOUDINARY_URL on import

import cloudinary  # noqa: E402
import cloudinary.uploader  # noqa: E402

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
CLOUDINARY_FOLDER = "pinepal/scans"

# Profile photos (my_profile.py): kind -> Cloudinary folder, and how Cloudinary resizes the
# photo as it stores it, so a 12 MP phone photo is kept small. Avatars are cropped square
# around the face, covers are kept wide (the screens crop them to fit).
PROFILE_PHOTOS = {
    "avatar": {
        "folder": "pinepal/avatars",
        "transformation": [{"width": 512, "height": 512, "crop": "fill", "gravity": "face"}],
    },
    "cover": {
        "folder": "pinepal/covers",
        "transformation": [{"width": 1600, "height": 900, "crop": "limit"}],
    },
}
OUR_FOLDERS = [CLOUDINARY_FOLDER] + [kind["folder"] for kind in PROFILE_PHOTOS.values()]

# The photo is checked by its first bytes, not by the name or type the phone sends
IMAGE_TYPES = {b"\xff\xd8\xff": "jpg", b"\x89PNG": "png"}

# Photos saved in uploads/ are named <scan_uuid>.jpg / .png
LOCAL_PHOTO = re.compile(r"[0-9a-f-]{36}\.(jpg|png)")


class PhotoStorageError(Exception):
    """Cloudinary could not take the photo (network, quota, bad settings)."""


def using_cloudinary():
    return bool(os.getenv("CLOUDINARY_URL"))


def is_remote(stored):
    return (stored or "").startswith(("https://", "http://"))


def photo_type(file_storage):
    """'jpg' or 'png' from the file's first bytes, or None for anything else."""
    head = file_storage.stream.read(8)
    file_storage.stream.seek(0)
    return next((ext for magic, ext in IMAGE_TYPES.items() if head.startswith(magic)), None)


def save_scan_photo(file_storage, scan_uuid):
    """Store an uploaded scan photo. Returns what goes in mobile_scans.image_path: the
    Cloudinary https URL, or the local file name. Returns None when the file is not a JPG or
    PNG, and raises PhotoStorageError when Cloudinary fails."""
    extension = photo_type(file_storage)
    if extension is None:
        return None

    if using_cloudinary():
        try:
            result = cloudinary.uploader.upload(
                file_storage.stream,
                folder=CLOUDINARY_FOLDER,
                public_id=uuid.uuid4().hex,
                resource_type="image",
                overwrite=False,
            )
        except Exception as error:
            raise PhotoStorageError(str(error)) from error
        url = result.get("secure_url")
        if not url:
            raise PhotoStorageError("Cloudinary returned no URL")
        return url

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"{scan_uuid}.{extension}"
    file_storage.save(os.path.join(UPLOAD_DIR, filename))
    return filename


def save_profile_photo(file_storage, kind):
    """Store a new avatar or cover photo (kind is a PROFILE_PHOTOS key). Returns what goes in
    users.avatar_url / cover_url: the Cloudinary https URL, or the local file name
    (<uuid>.jpg / .png in uploads/). Returns None when the file is not a JPG or PNG, and
    raises PhotoStorageError when Cloudinary fails."""
    extension = photo_type(file_storage)
    if extension is None:
        return None

    if using_cloudinary():
        settings = PROFILE_PHOTOS[kind]
        try:
            result = cloudinary.uploader.upload(
                file_storage.stream,
                folder=settings["folder"],
                public_id=uuid.uuid4().hex,
                resource_type="image",
                overwrite=False,
                transformation=settings["transformation"],
            )
        except Exception as error:
            raise PhotoStorageError(str(error)) from error
        url = result.get("secure_url")
        if not url:
            raise PhotoStorageError("Cloudinary returned no URL")
        return url

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"{uuid.uuid4()}.{extension}"  # the same shape as a scan photo, so /uploads serves it
    file_storage.save(os.path.join(UPLOAD_DIR, filename))
    return filename


def photo_url(stored, host_url):
    """The URL an <img> can load for a stored photo, or "" when there is none on the server.
    host_url is request.host_url, used for photos in uploads/."""
    stored = stored or ""
    if is_remote(stored):
        return stored
    if LOCAL_PHOTO.fullmatch(stored):
        return f"{host_url.rstrip('/')}/uploads/{stored}"
    return ""  # empty, or a path on the phone from before photos were uploaded


def cloudinary_public_id(url):
    """The public_id (pinepal/scans/<id> or <id>) from a Cloudinary delivery URL of a scan
    or profile photo, or None for any other URL.
    e.g. https://res.cloudinary.com/<cloud>/image/upload/v1700000000/pinepal/scans/<id>.jpg"""
    parsed = urlparse(url or "")
    if not parsed.netloc.endswith("cloudinary.com") or "/upload/" not in parsed.path:
        return None
    path = parsed.path.split("/upload/", 1)[1]
    path = re.sub(r"^v\d+/", "", path)
    public_id = os.path.splitext(path)[0]
    # Fixed-folder accounts put the folder in the public_id (pinepal/scans/<id>). Accounts in
    # dynamic folder mode may keep it out (just <id>), so accept both, but only our own ids.
    folders = "|".join(re.escape(folder) for folder in OUR_FOLDERS)
    if re.fullmatch(rf"(?:{folders})/[0-9a-f]{{32}}|[0-9a-f]{{32}}", public_id):
        return public_id
    return None


def delete_scan_photo(stored):
    """Best effort: remove a scan's (or a profile's) photo from Cloudinary. Never raises. Local files are left
    in uploads/ as before (the backups keep them)."""
    try:
        public_id = cloudinary_public_id(stored) if is_remote(stored) else None
        if public_id and using_cloudinary():
            cloudinary.uploader.destroy(public_id, resource_type="image", invalidate=True)
    except Exception:
        pass
