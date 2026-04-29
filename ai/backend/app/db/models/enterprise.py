"""Enterprise feature models for agent builder"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
from app.core.security import encrypt_string, decrypt_string
import enum
import json


class VariableType(str, enum.Enum):
    ENVIRONMENT = "environment"
    CONTENT = "content"


class Language(Base):
    """Language configuration for agents"""
    __tablename__ = "agent_languages"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    language_code = Column(String(10), nullable=False)  # en, fr, hi, etc.
    language_name = Column(String(100), nullable=False)  # English, French, etc.
    is_default = Column(Boolean, default=False)
    is_enabled = Column(Boolean, default=True)
    
    # Training data and responses
    training_data = Column(JSON, nullable=True)
    responses = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AgentVariable(Base):
    """Environment and content variables for agents"""
    __tablename__ = "agent_variables"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    variable_type = Column(SQLEnum(VariableType), nullable=False)
    name = Column(String(255), nullable=False, index=True)
    value = Column(Text, nullable=True)
    
    # For environment variables
    environment = Column(String(50), nullable=True)  # dev, staging, prod, etc.
    
    # For content variables
    language_code = Column(String(10), nullable=True)  # Language-specific values
    group = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    
    # Security
    is_encrypted = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def set_value(self, raw_value: str, encrypt: bool = False):
        """Set value with optional encryption"""
        self.is_encrypted = encrypt
        if encrypt and raw_value:
            self.value = encrypt_string(raw_value)
        else:
            self.value = raw_value

    def get_value(self) -> str:
        """Get decrypted value if encrypted"""
        if self.is_encrypted and self.value:
            return decrypt_string(self.value)
        return self.value


class ModelProvider(str, enum.Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    AZURE_OPENAI = "azure_openai"
    GOOGLE_GEMINI = "google_gemini"
    GROQ = "groq"
    OLLAMA = "ollama"
    CUSTOM_API = "custom_api"

class AIModel(Base):
    """AI Model configurations - Bring Your Own Key (BYOK)"""
    __tablename__ = "ai_models"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False) # Friendly name: "My GPT-4", "Production Claude"
    provider = Column(SQLEnum(ModelProvider), nullable=False)
    model_name = Column(String(255), nullable=False)  # gpt-4, claude-3-opus, etc.
    
    # Configuration
    api_key = Column(Text, nullable=True)  # Encrypted using Fernet
    base_url = Column(String(500), nullable=True) # For custom endpoints or Ollama
    api_version = Column(String(100), nullable=True) # For Azure
    organization_id = Column(String(255), nullable=True) # For OpenAI
    
    # Advanced settings (Temperature, Top-P, etc.)
    settings = Column(JSON, nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def set_api_key(self, key: str):
        """Encrypt and set API key"""
        if key:
            self.api_key = encrypt_string(key)
        else:
            self.api_key = None

    def get_api_key(self) -> str:
        """Decrypt and return API key"""
        if self.api_key:
            return decrypt_string(self.api_key)
        return None


class Prompt(Base):
    """Prompt library for GenAI features"""
    __tablename__ = "prompts"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    prompt_type = Column(String(50), default="system")  # system, custom
    feature_name = Column(String(255), nullable=True)
    
    # Content
    content = Column(Text, nullable=False)
    model_id = Column(Integer, ForeignKey("ai_models.id"), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class GenAIFeature(Base):
    """GenAI feature configurations"""
    __tablename__ = "genai_features"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    feature_name = Column(String(255), nullable=False)  # Agent Node, Dialog Generation, etc.
    description = Column(Text, nullable=True)
    
    # Configuration
    model_id = Column(Integer, ForeignKey("ai_models.id"), nullable=True)
    prompt_id = Column(Integer, ForeignKey("prompts.id"), nullable=True)
    
    # Status
    is_enabled = Column(Boolean, default=False)
    config = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Guardrail(Base):
    """Safeguards and guardrails"""
    __tablename__ = "guardrails"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    guardrail_name = Column(String(255), nullable=False)  # Restrict Toxicity, etc.
    description = Column(Text, nullable=True)
    
    # Configuration
    is_enabled = Column(Boolean, default=False)
    llm_input_features = Column(Integer, default=0)
    llm_output_features = Column(Integer, default=0)
    config = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Integration(Base):
    """Integration configurations"""
    __tablename__ = "integrations"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    integration_type = Column(String(100), nullable=False)  # salesforce, zendesk, etc.
    name = Column(String(255), nullable=False)
    
    # Configuration
    credentials = Column(JSON, nullable=True)  # Encrypted
    config = Column(JSON, nullable=True)
    is_configured = Column(Boolean, default=False)
    is_active = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def set_credentials(self, creds: dict):
        """Encrypt and set credentials"""
        if creds:
            creds_str = json.dumps(creds)
            self.credentials = {"encrypted_data": encrypt_string(creds_str)}
        else:
            self.credentials = None

    def get_credentials(self) -> dict:
        """Decrypt and return credentials"""
        if self.credentials and "encrypted_data" in self.credentials:
            decrypted_str = decrypt_string(self.credentials["encrypted_data"])
            try:
                return json.loads(decrypted_str)
            except json.JSONDecodeError:
                return {}
        return self.credentials or {}


class ChangeLog(Base):
    """Audit trail for agent changes"""
    __tablename__ = "changelogs"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    user_id = Column(Integer, nullable=True)
    user_email = Column(String(255), nullable=True)
    
    # Change details
    module = Column(String(100), nullable=True)  # profile, nodes, settings, etc.
    change_type = Column(String(50), nullable=False)  # create, update, delete
    changes = Column(JSON, nullable=True)  # Detailed change information
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())





class Role(Base):
    """User roles for agents"""
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    role_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    role_type = Column(String(50), default="custom")  # system, custom
    
    # Permissions
    permissions = Column(JSON, nullable=True)  # List of permissions
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class UserRole(Base):
    """User-role assignments"""
    __tablename__ = "user_roles"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

