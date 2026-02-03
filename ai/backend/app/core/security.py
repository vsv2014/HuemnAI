from datetime import datetime, timedelta
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Security, HTTPException
from jose import jwt, JWTError
from cryptography.fernet import Fernet
import base64
import hashlib
from app.core.config import settings

ALGORITHM = "HS256"
security = HTTPBearer(auto_error=False)

# Encryption Key Derivation (Ensure valid Fernet key)
def _get_fernet_key() -> bytes:
    # Use existing SECRET_KEY, hash it to 32 bytes, then base64 encode
    key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return base64.urlsafe_b64encode(key)

_fernet = Fernet(_get_fernet_key())

def encrypt_string(plain_text: str) -> str:
    """Encrypts a sensitive string (e.g. API Key) for storage."""
    if not plain_text:
        return ""
    return _fernet.encrypt(plain_text.encode()).decode()

def decrypt_string(cipher_text: str) -> str:
    """Decrypts a sensitive string."""
    if not cipher_text:
        return ""
    try:
        return _fernet.decrypt(cipher_text.encode()).decode()
    except Exception:
        # Fallback for unencrypted legacy data or errors
        return cipher_text

def create_access_token(data: dict):
    expire = datetime.utcnow() + timedelta(hours=24)
    data.update({"exp": expire})
    return jwt.encode(data, settings.SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str):
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
):
    if not credentials:
        return None
    return decode_access_token(credentials.credentials)
