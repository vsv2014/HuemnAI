from datetime import datetime, timedelta
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Security, HTTPException
import jwt
import os
import base64
import hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.core.config import settings

ALGORITHM = "HS256"
security = HTTPBearer(auto_error=False)

# AES-256-GCM Implementation for Enterprise-grade Encryption
def _get_aes_key() -> bytes:
    """Derives a 32-byte (256-bit) key from the SECRET_KEY"""
    return hashlib.sha256(settings.SECRET_KEY.encode()).digest()

def encrypt_string(plain_text: str) -> str:
    """Encrypts a sensitive string using AES-256-GCM."""
    if not plain_text:
        return ""
    
    key = _get_aes_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)  # GCM recommended nonce size
    
    ciphertext = aesgcm.encrypt(nonce, plain_text.encode(), None)
    
    # Combine nonce and ciphertext, then base64 encode for storage
    return base64.b64encode(nonce + ciphertext).decode('utf-8')

def decrypt_string(cipher_text: str) -> str:
    """Decrypts an AES-256-GCM encrypted string."""
    if not cipher_text:
        return ""
    
    try:
        data = base64.b64decode(cipher_text.encode('utf-8'))
        nonce = data[:12]
        ciphertext = data[12:]
        
        key = _get_aes_key()
        aesgcm = AESGCM(key)
        
        return aesgcm.decrypt(nonce, ciphertext, None).decode('utf-8')
    except Exception:
        # Fallback for legacy Fernet or unencrypted data
        try:
            from cryptography.fernet import Fernet
            # Legacy Fernet derivation
            f_key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest())
            return Fernet(f_key).decrypt(cipher_text.encode()).decode()
        except Exception:
            return cipher_text

def create_access_token(data: dict):
    expire = datetime.utcnow() + timedelta(hours=24)
    data.update({"exp": expire})
    return jwt.encode(data, settings.SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str):
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
):
    if not credentials:
        return None
    return decode_access_token(credentials.credentials)
