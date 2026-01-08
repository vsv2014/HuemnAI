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


def get_llm_config(provider: str = None) -> Optional[Dict[str, Any]]:
    """
    Get LLM configuration from database or environment.
    Returns config dict with api_key, model, etc.
    """
    db = SessionLocal()
    try:
        # Try to get from database (default provider first)
        try:
            query = db.query(APIConfig).filter(
                APIConfig.provider_type == "llm",
                APIConfig.is_active == True
            )
            
            if provider:
                # Case-insensitive provider lookup
                provider_lower = provider.lower()
                config = query.filter(
                    func.lower(APIConfig.provider) == provider_lower
                ).first()
                
                # If not found with case-insensitive, try exact match
                if not config:
                    config = query.filter(APIConfig.provider == provider).first()
            else:
                # Get default provider first
                config = query.filter(APIConfig.is_default == True).first()
                
                # If no default, get any active LLM config
                if not config:
                    config = query.first()
            
        except Exception as e:
            # Table doesn't exist yet or other DB error - fall back to env vars
            logger.debug(f"Database query failed (table may not exist): {e}")
            config = None
        
        if config:
            api_key = config.get_api_key()
            # If API key is empty, treat as not configured
            if not api_key:
                logger.warning(f"LLM config found for provider '{config.provider}' but API key is empty or could not be decrypted")
                return None
            
            return {
                "provider": config.provider,
                "api_key": api_key,
                "config_data": config.config_data or {},
                "is_database": True
            }
        
        # Fallback to environment variables (only if no UI config exists)
        # Note: Environment variables are deprecated - users should configure via UI
        # This fallback is kept for backward compatibility only
        if provider == "azure" or (not provider and os.getenv("AZURE_OPENAI_KEY")):
            return {
                "provider": "azure",
                "api_key": os.getenv("AZURE_OPENAI_KEY"),
                "config_data": {
                    "endpoint": os.getenv("AZURE_OPENAI_ENDPOINT"),
                    "api_version": os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview"),
                    "deployment_name": os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-35-turbo")
                },
                "is_database": False
            }
        elif provider == "anthropic" or (not provider and os.getenv("ANTHROPIC_API_KEY")):
            return {
                "provider": "anthropic",
                "api_key": os.getenv("ANTHROPIC_API_KEY"),
                "config_data": {
                    "model": os.getenv("ANTHROPIC_MODEL", "claude-3-sonnet")
                },
                "is_database": False
            }
        else:
            # Default to OpenAI (but return None if no key to force UI configuration)
            env_key = os.getenv("OPENAI_API_KEY")
            if not env_key:
                # No environment key - return None to indicate UI configuration is required
                return None
            return {
                "provider": "openai",
                "api_key": env_key,
                "config_data": {
                    "model": os.getenv("OPENAI_MODEL", "gpt-3.5-turbo"),
                    "embedding_model": os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
                },
                "is_database": False
            }
    except Exception as e:
        logger.error(f"Error getting LLM config: {e}", exc_info=True)
        # Fallback to environment (only if key exists)
        # Check for different providers
        if os.getenv("AZURE_OPENAI_KEY"):
            return {
                "provider": "azure",
                "api_key": os.getenv("AZURE_OPENAI_KEY"),
                "config_data": {
                    "endpoint": os.getenv("AZURE_OPENAI_ENDPOINT"),
                    "api_version": os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview"),
                    "deployment_name": os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-35-turbo")
                },
                "is_database": False
            }
        elif os.getenv("ANTHROPIC_API_KEY"):
            return {
                "provider": "anthropic",
                "api_key": os.getenv("ANTHROPIC_API_KEY"),
                "config_data": {
                    "model": os.getenv("ANTHROPIC_MODEL", "claude-3-sonnet")
                },
                "is_database": False
            }
        
        env_key = os.getenv("OPENAI_API_KEY")
        if not env_key:
            # No environment key - return None to indicate UI configuration is required
            return None
        return {
            "provider": "openai",
            "api_key": env_key,
            "config_data": {
                "model": os.getenv("OPENAI_MODEL", "gpt-3.5-turbo"),
                "embedding_model": os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
            },
            "is_database": False
        }
    finally:
        db.close()


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
                APIConfig.is_active == True
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

