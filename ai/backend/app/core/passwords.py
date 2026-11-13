"""Versioned password hashing with transparent legacy SHA-256 verification.

New passwords use salted PBKDF2-HMAC-SHA256 (600k iterations); the legacy unsalted
SHA-256 form is accepted only to authenticate and opportunistically migrate
existing accounts. Migrations must not reset users' passwords or lock them out.
"""
import base64
import hashlib
import hmac
import secrets
import string

ALGORITHM = "pbkdf2_sha256"
ITERATIONS = 600_000
SALT_BYTES = 16
MAX_VERIFY_ITERATIONS = 1_200_000


def hash_password(password: str) -> str:
    if not isinstance(password, str) or not password:
        raise ValueError("Password must not be empty")
    salt = secrets.token_bytes(SALT_BYTES)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, ITERATIONS)
    return "$".join([
        ALGORITHM,
        str(ITERATIONS),
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(digest).decode("ascii"),
    ])


def verify_password(password: str, stored_hash: str) -> bool:
    if not isinstance(password, str) or not isinstance(stored_hash, str):
        return False
    if stored_hash.startswith(ALGORITHM + "$"):
        parts = stored_hash.split("$")
        if len(parts) != 4:
            return False
        try:
            rounds = int(parts[1])
            if not (1 <= rounds <= MAX_VERIFY_ITERATIONS):
                return False
            salt = base64.b64decode(parts[2], validate=True)
            expected = base64.b64decode(parts[3], validate=True)
        except (ValueError, TypeError):
            return False
        if len(salt) < 16 or len(expected) != 32:
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, rounds)
        return hmac.compare_digest(actual, expected)
    # The old system used exactly one raw, unsalted 64-character SHA-256 hex digest.
    if len(stored_hash) == 64 and all(ch in string.hexdigits for ch in stored_hash):
        legacy = hashlib.sha256(password.encode("utf-8")).hexdigest()
        return hmac.compare_digest(legacy, stored_hash.lower())
    return False


def needs_rehash(stored_hash: str) -> bool:
    """Upgrade legacy hashes and outdated PBKDF2 work factors on successful login."""
    if not isinstance(stored_hash, str):
        return True
    parts = stored_hash.split("$")
    if len(parts) != 4 or parts[0] != ALGORITHM:
        return True
    try:
        return int(parts[1]) < ITERATIONS
    except ValueError:
        return True
