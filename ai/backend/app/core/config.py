import os
from dotenv import load_dotenv
from typing import Literal

load_dotenv()

class Settings:
    # Core
    APP_NAME = "HUEMN.Ai"
    ENV = os.getenv("ENV", "dev")
    IS_PROD = ENV.lower() in ("prod", "production")

    # Database
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./huemn.db" if not IS_PROD else "")
    if IS_PROD:
        if not DATABASE_URL:
            raise RuntimeError("DATABASE_URL is required in production and must point to PostgreSQL")
        if DATABASE_URL.startswith("sqlite"):
            raise RuntimeError("SQLite is not allowed in production. Set DATABASE_URL to PostgreSQL.")

    # Redis / Cache
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

    # Security
    SECRET_KEY = os.getenv("SECRET_KEY", "fixed-dev-secret-key-do-not-use-in-prod-123")

    # LLM - Supports multiple providers
    LLM_MODE: Literal["llm", "rules", "hybrid"] = os.getenv("LLM_MODE", "hybrid")
    DEFAULT_LLM = os.getenv("DEFAULT_LLM", "openai")  # Can be "openai", "azure", or auto-detected

    # OpenAI Configuration - Now configured via UI (Settings page)
    # These are kept for backward compatibility but should be set via UI
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")  # Deprecated: Use UI Settings instead
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")  # Deprecated: Use UI Settings instead
    OPENAI_EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")  # Deprecated: Use UI Settings instead
    
    # Azure OpenAI Configuration - Now configured via UI (Settings page)
    # These are kept for backward compatibility but should be set via UI
    AZURE_OPENAI_KEY = os.getenv("AZURE_OPENAI_KEY")  # Deprecated: Use UI Settings instead
    AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")  # Deprecated: Use UI Settings instead
    AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")  # Deprecated: Use UI Settings instead
    AZURE_OPENAI_DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-35-turbo")  # Deprecated: Use UI Settings instead
    
    # Connector Configuration - Auto-detected from environment
    JIRA_URL = os.getenv("JIRA_URL")
    JIRA_EMAIL = os.getenv("JIRA_EMAIL")
    JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN")
    
    ZENDESK_SUBDOMAIN = os.getenv("ZENDESK_SUBDOMAIN")
    ZENDESK_EMAIL = os.getenv("ZENDESK_EMAIL")
    ZENDESK_API_TOKEN = os.getenv("ZENDESK_API_TOKEN")
    
    SALESFORCE_USERNAME = os.getenv("SALESFORCE_USERNAME")
    SALESFORCE_PASSWORD = os.getenv("SALESFORCE_PASSWORD")
    SALESFORCE_SECURITY_TOKEN = os.getenv("SALESFORCE_SECURITY_TOKEN")
    
    GREENHOUSE_API_KEY = os.getenv("GREENHOUSE_API_KEY")
    
    LINKEDIN_CLIENT_ID = os.getenv("LINKEDIN_CLIENT_ID")
    LINKEDIN_CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET")
    LINKEDIN_ACCESS_TOKEN = os.getenv("LINKEDIN_ACCESS_TOKEN")

    # Status engine
    IDLE_TIMEOUT_SECONDS = int(os.getenv("IDLE_TIMEOUT_SECONDS", 300))

    # Admin API key (optional) - used to protect admin endpoints like reindex
    ADMIN_API_KEY = os.getenv("ADMIN_API_KEY")

    # Connectors control
    USE_REAL_CONNECTORS = os.getenv("USE_REAL_CONNECTORS", "0") == "1"

    # Channels (future-proof)
    ENABLED_CHANNELS = ["web", "mobile", "whatsapp", "slack", "teams", "email", "api"]
    
    # Subscription & Development
    BYPASS_SUBSCRIPTION = os.getenv("BYPASS_SUBSCRIPTION", "1") == "1"  # Set to "0" to enable subscription checks
    STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
    STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

    # Email Configuration
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "noreply@huemn.ai")
    SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "HUEMN.Ai Team")
    SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "1") == "1"
    
    # Twilio / Telephony Configuration
    TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
    TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
    TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")
    TWILIO_API_KEY_SID = os.getenv("TWILIO_API_KEY_SID")
    TWILIO_API_KEY_SECRET = os.getenv("TWILIO_API_KEY_SECRET")
    TWILIO_APP_SID = os.getenv("TWILIO_APP_SID") # TwiML App SID for browser calls
    API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")  # Base URL for webhooks

    # HuemnVoice / Voice Configuration
    HUEMN_VOICE_API_KEY = os.getenv("HUEMN_VOICE_API_KEY", os.getenv("ELEVENLABS_API_KEY"))
    DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")

    # Sentry / Logging
    SENTRY_DSN = os.getenv("SENTRY_DSN", "")
    SENTRY_TRACES_SAMPLE_RATE = float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.0"))
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

    # Celery / Broker
    CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", os.getenv("REDIS_URL", "redis://localhost:6379"))
    CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", os.getenv("REDIS_URL", "redis://localhost:6379"))

    # File storage (pluggable)
    STORAGE_PROVIDER = os.getenv("STORAGE_PROVIDER", "local")  # or 's3'
    S3_BUCKET = os.getenv("S3_BUCKET")
    S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY")
    S3_SECRET_KEY = os.getenv("S3_SECRET_KEY")
    S3_REGION = os.getenv("S3_REGION", "us-east-1")

settings = Settings()
