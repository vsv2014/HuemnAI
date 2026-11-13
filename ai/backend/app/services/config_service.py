"""
Service to retrieve user-configured API keys and settings from database.
Falls back to environment variables if no database config exists.
"""
from typing import Optional, Dict, Any
from app.db.session import SessionLocal
from app.db.models.api_config import APIConfig
from sqlalchemy import func
import os
import logging

logger = logging.getLogger(__name__)


def _env_llm_config(provider: str | None) -> Optional[Dict[str, Any]]:
    """Only return a key for its own provider; never reuse an OpenAI key for Groq."""
    wanted = (provider or os.getenv("DEFAULT_LLM", "openai")).lower()
    if wanted in ("anthropic", "claude"):
        key = os.getenv("ANTHROPIC_API_KEY")
        return ({"provider": "anthropic", "api_key": key,
                 "config_data": {"model": os.getenv("ANTHROPIC_MODEL")},
                 "is_database": False} if key else None)
    if wanted in ("google", "gemini", "google_gemini"):
        key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        return ({"provider": "google", "api_key": key,
                 "config_data": {"model": os.getenv("GEMINI_MODEL")},
                 "is_database": False} if key else None)
    if wanted == "azure":
        key = os.getenv("AZURE_OPENAI_KEY")
        return ({"provider": "azure", "api_key": key,
                 "config_data": {
                     "endpoint": os.getenv("AZURE_OPENAI_ENDPOINT"),
                     "api_version": os.getenv("AZURE_OPENAI_API_VERSION"),
                     "deployment_name": os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
                 }, "is_database": False} if key else None)
    if wanted == "openai":
        key = os.getenv("OPENAI_API_KEY")
        return ({"provider": "openai", "api_key": key,
                 "config_data": {
                     "model": os.getenv("OPENAI_MODEL"),
                     "embedding_model": os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
                 }, "is_database": False} if key else None)
    # Do not substitute another provider's managed credentials.
    return None


def get_llm_config(provider: str = None) -> Optional[Dict[str, Any]]:
    """Resolve per-user BYOK config or explicit managed environment credentials.

    APIConfig rows must always be bound to the authenticated principal.
    Calls without a principal (e.g. Celery) can use only explicitly managed
    credentials, not an arbitrary user's stored BYOK key.
    """
    from app.core.provider_scope import get_provider_user_id
    principal = get_provider_user_id()
    wanted = (provider or "").lower()
    aliases = {
        "claude": "anthropic", "gemini": "google",
        "google_gemini": "google",
    }
    wanted = aliases.get(wanted, wanted)
    db = SessionLocal()
    try:
        query = db.query(APIConfig).filter(
            APIConfig.provider_type == "llm",
            APIConfig.is_active == True,
            APIConfig.user_id == (str(principal) if principal is not None else "__managed__"),
        )
        if wanted:
            query = query.filter(func.lower(APIConfig.provider) == wanted)
        else:
            preferred = query.filter(APIConfig.is_default == True).first()
            config = preferred or query.order_by(APIConfig.id.asc()).first()
            if config:
                secret = config.get_api_key()
                if secret or config.provider.lower() == "ollama":
                    return {"provider": config.provider.lower(), "api_key": secret,
                            "config_data": config.config_data or {}, "is_database": True}
                return None
            return _env_llm_config(None)

        config = query.first()
        if config:
            secret = config.get_api_key()
            if secret or wanted == "ollama":
                return {"provider": wanted, "api_key": secret,
                        "config_data": config.config_data or {}, "is_database": True}
            return None
        return _env_llm_config(wanted)
    except Exception:
        logger.exception("Unable to resolve LLM provider configuration")
        # A DB outage must not silently select another tenant or provider.
        return None
    finally:
        db.close()


from app.core.provider_scope import get_provider_user_id

def get_connector_config(connector_type: str) -> Optional[Dict[str, Any]]:
    """
    Get connector configuration from database or environment.
    """
    db = SessionLocal()
    try:
        try:
            config = db.query(APIConfig).filter(
                APIConfig.provider_type == "connector",
                APIConfig.provider == connector_type,
                APIConfig.is_active == True,
                APIConfig.user_id == (str(get_provider_user_id()) if get_provider_user_id() is not None else "__managed__")
            ).first()
        except Exception as e:
            # Table doesn't exist yet or other DB error - fall back to env vars
            logger.debug(f"Database query failed (table may not exist): {e}")
            config = None
        
        if config:
            result = {
                "provider": config.provider,
                "config_data": config.config_data or {},
                "is_database": True
            }
            
            # Add encrypted fields
            api_key = config.get_api_key()
            if api_key:
                result["api_key"] = api_key
            
            secret = config.get_secret()
            if secret:
                result["secret"] = secret
            
            password = config.get_password()
            if password:
                result["password"] = password
            
            return result
        
        # Fallback to environment variables
        if connector_type == "jira":
            return {
                "provider": "jira",
                "config_data": {
                    "url": os.getenv("JIRA_URL"),
                    "email": os.getenv("JIRA_EMAIL")
                },
                "api_key": os.getenv("JIRA_API_TOKEN"),
                "is_database": False
            }
        elif connector_type == "zendesk":
            return {
                "provider": "zendesk",
                "config_data": {
                    "subdomain": os.getenv("ZENDESK_SUBDOMAIN"),
                    "email": os.getenv("ZENDESK_EMAIL")
                },
                "api_key": os.getenv("ZENDESK_API_TOKEN"),
                "is_database": False
            }
        elif connector_type == "salesforce":
            return {
                "provider": "salesforce",
                "config_data": {
                    "username": os.getenv("SALESFORCE_USERNAME")
                },
                "password": os.getenv("SALESFORCE_PASSWORD"),
                "secret": os.getenv("SALESFORCE_SECURITY_TOKEN"),
                "is_database": False
            }
        elif connector_type == "greenhouse":
            return {
                "provider": "greenhouse",
                "api_key": os.getenv("GREENHOUSE_API_KEY"),
                "is_database": False
            }
        elif connector_type == "linkedin":
            return {
                "provider": "linkedin",
                "config_data": {
                    "client_id": os.getenv("LINKEDIN_CLIENT_ID")
                },
                "secret": os.getenv("LINKEDIN_CLIENT_SECRET"),
                "api_key": os.getenv("LINKEDIN_ACCESS_TOKEN"),
                "is_database": False
            }
        
        return None
    except Exception as e:
        logger.error(f"Error getting connector config: {e}", exc_info=True)
        return None
    finally:
        db.close()

