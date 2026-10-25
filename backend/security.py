import bcrypt


def hash_password(password):
    # $2b$ bcrypt hashes are also accepted by PHP's password_verify().
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password, stored_hash):
    # Hashes made by the PHP version start with $2y$; bcrypt expects $2b$.
    normalized = stored_hash.replace("$2y$", "$2b$", 1).encode()
    try:
        return bcrypt.checkpw(password.encode(), normalized)
    except ValueError:
        return False
