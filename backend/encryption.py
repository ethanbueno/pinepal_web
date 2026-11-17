"""Encryption of stored data, with one secret key kept in .env (DATA_ENCRYPTION_KEY).

What is encrypted:
  - IP addresses in login_history and audit_logs. They are personal data and nothing
    searches or sorts by them, so the database only ever holds the encrypted text.
    The Audit logs page decrypts them for admins (audit_logs.py).
  - Backups (backup.py): database.sql and every photo in the zip. restore.py decrypts them.

Passwords are not here: they are hashed with bcrypt (security.py), which can't be undone.
Fields the app searches, sorts or joins on (usernames, farmer names, municipality) stay
readable, because the database can't compare encrypted text.

The cipher is Fernet (from the cryptography package): AES-128 in CBC mode with a random IV
for every value, plus an HMAC-SHA256 signature, so a changed or damaged value is refused
instead of decrypted wrongly. The same IP encrypts to different text every time.

Make a key once and put it in backend/.env (and in Render's environment):
    python encryption.py
Keep a copy somewhere safe (a password manager). Without it the encrypted IP addresses and
the backups can't be read. Without a key set, values are saved readable, as before.
"""
import os

from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv

load_dotenv(override=True)

KEY_NAME = "DATA_ENCRYPTION_KEY"
# every Fernet token starts with this (version byte 0x80, base64)
TOKEN_PREFIX = "gAAAAA"

_fernet = None


def cipher():
    """The Fernet cipher from DATA_ENCRYPTION_KEY, or None when no key is set."""
    global _fernet
    if _fernet is None:
        key = os.getenv(KEY_NAME)
        if not key:
            return None
        _fernet = Fernet(key.encode())
    return _fernet


def require_cipher():
    fernet = cipher()
    if fernet is None:
        raise SystemExit(f"{KEY_NAME} is not set in backend/.env. Make one with: python encryption.py")
    return fernet


def encrypt_text(value):
    """Encrypt a short text (an IP address). None and "" stay as they are."""
    fernet = cipher()
    if not value or fernet is None:
        return value
    return fernet.encrypt(value.encode()).decode()


def decrypt_text(value):
    """The readable text. Rows saved before encryption are readable already and come back as
    they are; a value that can't be decrypted (another key) shows as "(encrypted)"."""
    if not value or not value.startswith(TOKEN_PREFIX):
        return value
    fernet = cipher()
    if fernet is None:
        return "(encrypted)"
    try:
        return fernet.decrypt(value.encode()).decode()
    except InvalidToken:
        return "(encrypted)"


def encrypt_bytes(data):
    return require_cipher().encrypt(data)


def decrypt_bytes(data):
    try:
        return require_cipher().decrypt(data)
    except InvalidToken:
        raise SystemExit(f"This backup can't be decrypted: it was made with another {KEY_NAME}, or it is damaged.")


if __name__ == "__main__":
    print("Add this line to backend/.env (and to Render's environment variables):\n")
    print(f"{KEY_NAME}={Fernet.generate_key().decode()}\n")
    print("Keep a copy in a password manager. Losing it means the encrypted IP addresses and")
    print("backups can't be read. Don't change it once data is encrypted with it.")
