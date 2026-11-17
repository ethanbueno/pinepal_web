import re

import bcrypt

# Password hashes live in their own table, user_credentials, split off from users (vertical
# partitioning, migrate_optimization.py): the users row everyone reads has no secret in it,
# and only signing in and changing a password touch user_credentials.

# SELECT for signing in: the account plus its password hash
LOGIN_SELECT = (
    "SELECT u.*, c.password_hash FROM users u LEFT JOIN user_credentials c ON c.user_id = u.id"
)


# Password rules, the same on the web and mobile sign-up forms. They only apply when a password
# is set (sign up, add user or farmer, reset, change), so older passwords still sign in.
MIN_PASSWORD = 8
MAX_PASSWORD_BYTES = 72  # bcrypt can't hash more than 72 bytes
SYMBOL = re.compile(r"[^A-Za-z0-9\s]")


def password_problem(password):
    """The first rule a new password breaks, as a message for the user, or None if it's fine."""
    if len(password) < MIN_PASSWORD:
        return f"Password must be at least {MIN_PASSWORD} characters"
    if len(password.encode()) > MAX_PASSWORD_BYTES:
        return "Password is too long (72 characters at most)"
    if not re.search(r"[A-Z]", password):
        return "Password needs at least 1 uppercase letter"
    if not SYMBOL.search(password):
        return "Password needs at least 1 special symbol, like ! @ # or $"
    return None


def hash_password(password):
    # $2b$ bcrypt hashes are also accepted by PHP's password_verify().
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password, stored_hash):
    if not stored_hash:  # an account without credentials can't sign in
        return False
    # Hashes made by the PHP version start with $2y$; bcrypt expects $2b$.
    normalized = stored_hash.replace("$2y$", "$2b$", 1).encode()
    try:
        return bcrypt.checkpw(password.encode(), normalized)
    except ValueError:
        return False


def set_password(cursor, user_id, password):
    """Save a new password for an account (a new account, or a reset)."""
    cursor.execute(
        "INSERT INTO user_credentials (user_id, password_hash) VALUES (%s, %s) "
        "ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)",
        (user_id, hash_password(password)),
    )


def stored_password_hash(cursor, user_id):
    """The account's password hash, or None."""
    cursor.execute("SELECT password_hash FROM user_credentials WHERE user_id = %s", (user_id,))
    row = cursor.fetchone()
    if not row:
        return None
    return row["password_hash"] if isinstance(row, dict) else row[0]
