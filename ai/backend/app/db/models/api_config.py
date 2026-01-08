"""
Database model for storing user API keys and configurations.
Sensitive data is encrypted at rest.
"""
from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base
import json
import os
import base64

# Try to import cryptography
try:
    from cryptography.fernet import Fernet
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False
    Fernet = None

# Generate encryption key (in production, use a secure key management system)
def get_encryption_key():
    """Get or generate encryption key for sensitive data"""
    if not CRYPTO_AVAILABLE:
        return None
    key = os.getenv("ENCRYPTION_KEY")
    if not key:
        # Generate a key (in production, this should be set as env var)
        key = Fernet.generate_key().decode()
        print(f"WARNING: Generated new encryption key. Set ENCRYPTION_KEY={key} in production!")
    else:
        key = key.encode() if isinstance(key, str) else key
    return key

_fernet = Fernet(get_encryption_key()) if CRYPTO_AVAILABLE and get_encryption_key() else None


def encrypt_value(value: str) -> str:
    """Encrypt a sensitive value"""
    if not value or not _fernet:
        # If crypto not available, store as-is (not recommended for production)
        return value
    try:
        return _fernet.encrypt(value.encode()).decode()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Encryption error: {e}")
        return value


def decrypt_value(encrypted_value: str) -> str:
    """Decrypt a sensitive value"""
    if not encrypted_value or not _fernet:
        return encrypted_value
    try:
        return _fernet.decrypt(encrypted_value.encode()).decode()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Decryption error: {e}")
        return encrypted_value


def mask_value(value: str, show_first: int = 4, show_last: int = 4) -> str:
    """Mask a value showing only first and last characters"""
    if not value or len(value) <= show_first + show_last:
        return "*" * len(value) if value else ""
    return f"{value[:show_first]}{'*' * (len(value) - show_first - show_last)}{value[-show_last:]}"


class APIConfig(Base):
    __tablename__ = "api_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True, default="default")  # For multi-user support later
    provider = Column(String, nullable=False, index=True)  # openai, azure, jira, zendesk, etc.
    provider_type = Column(String, nullable=False)  # llm, connector, etc.
    
    # Configuration data (encrypted sensitive fields stored separately)
    config_data = Column(JSON, nullable=True)  # Non-sensitive config (models, endpoints, etc.)
    
    # Encrypted sensitive fields
    encrypted_api_key = Column(Text, nullable=True)  # Encrypted API key
    encrypted_secret = Column(Text, nullable=True)  # Encrypted secret/token
    encrypted_password = Column(Text, nullable=True)  # Encrypted password
    
    # Status
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)  # Default provider for this type
    
    # Metadata
    name = Column(String, nullable=True)  # User-friendly name
    description = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def set_api_key(self, value: str):
        """Set and encrypt API key"""
        if value:
            self.encrypted_api_key = encrypt_value(value)
    
    def get_api_key(self) -> str:
        """Get and decrypt API key"""
        return decrypt_value(self.encrypted_api_key) if self.encrypted_api_key else ""
    
    def get_masked_api_key(self) -> str:
        """Get masked API key for display"""
        key = self.get_api_key()
        return mask_value(key)
    
    def set_secret(self, value: str):
        """Set and encrypt secret"""
        if value:
            self.encrypted_secret = encrypt_value(value)
    
    def get_secret(self) -> str:
        """Get and decrypt secret"""
        return decrypt_value(self.encrypted_secret) if self.encrypted_secret else ""
    
    def get_masked_secret(self) -> str:
        """Get masked secret for display"""
        secret = self.get_secret()
        return mask_value(secret)
    
    def set_password(self, value: str):
        """Set and encrypt password"""
        if value:
            self.encrypted_password = encrypt_value(value)
    
    def get_password(self) -> str:
        """Get and decrypt password"""
        return decrypt_value(self.encrypted_password) if self.encrypted_password else ""
    
    def to_dict(self, include_sensitive: bool = False) -> dict:
        """Convert to dictionary, optionally including sensitive data"""
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "provider": self.provider,
            "provider_type": self.provider_type,
            "config_data": self.config_data or {},
            "is_active": self.is_active,
            "is_default": self.is_default,
            "name": self.name,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_sensitive:
            data["api_key"] = self.get_api_key()
            data["secret"] = self.get_secret()
            data["password"] = self.get_password()
        else:
            data["api_key"] = self.get_masked_api_key()
            data["secret"] = self.get_masked_secret()
            data["password"] = "***" if self.encrypted_password else ""
        
        return data

