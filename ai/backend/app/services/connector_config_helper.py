"""
Helper functions for connectors to get configuration from UI Settings or environment variables.
All connectors should use these functions to get their credentials.
"""
from typing import Optional, Dict, Any
from app.services.config_service import get_connector_config
import os
import logging

logger = logging.getLogger(__name__)


def get_connector_credentials(connector_type: str) -> Optional[Dict[str, Any]]:
    """
    Get connector credentials from UI configuration or environment variables.
    Returns dict with all necessary credentials for the connector.
    """
    # Try to get from UI configuration first
    config = get_connector_config(connector_type)
    
    if config and config.get("is_database"):
        # Use UI-configured credentials
        credentials = {
            "config_data": config.get("config_data", {}),
            "api_key": config.get("api_key"),
            "secret": config.get("secret"),
            "password": config.get("password"),
            "is_ui_configured": True
        }
        
        # Map connector-specific fields
        if connector_type == "zendesk":
            return {
                "subdomain": credentials["config_data"].get("subdomain"),
                "email": credentials["config_data"].get("email"),
                "api_token": credentials.get("api_key"),
                "is_ui_configured": True
            }
        elif connector_type == "jira":
            return {
                "url": credentials["config_data"].get("url"),
                "email": credentials["config_data"].get("email"),
                "api_token": credentials.get("api_key"),
                "is_ui_configured": True
            }
        elif connector_type == "salesforce":
            return {
                "username": credentials["config_data"].get("username"),
                "password": credentials.get("password"),
                "security_token": credentials.get("secret"),
                "is_ui_configured": True
            }
        elif connector_type == "greenhouse":
            return {
                "api_key": credentials.get("api_key"),
                "is_ui_configured": True
            }
        elif connector_type == "linkedin":
            return {
                "client_id": credentials["config_data"].get("client_id"),
                "client_secret": credentials.get("secret"),
                "access_token": credentials.get("api_key"),  # access_token is stored as api_key
                "is_ui_configured": True
            }
    
    # Fallback to environment variables (deprecated)
    if connector_type == "zendesk":
        return {
            "subdomain": os.getenv("ZENDESK_SUBDOMAIN"),
            "email": os.getenv("ZENDESK_EMAIL"),
            "api_token": os.getenv("ZENDESK_API_TOKEN"),
            "is_ui_configured": False
        }
    elif connector_type == "jira":
        return {
            "url": os.getenv("JIRA_URL") or os.getenv("JIRA_BASE_URL"),
            "email": os.getenv("JIRA_EMAIL") or os.getenv("JIRA_USER"),
            "api_token": os.getenv("JIRA_API_TOKEN"),
            "is_ui_configured": False
        }
    elif connector_type == "salesforce":
        return {
            "username": os.getenv("SALESFORCE_USERNAME"),
            "password": os.getenv("SALESFORCE_PASSWORD"),
            "security_token": os.getenv("SALESFORCE_SECURITY_TOKEN"),
            "is_ui_configured": False
        }
    elif connector_type == "greenhouse":
        return {
            "api_key": os.getenv("GREENHOUSE_API_KEY"),
            "is_ui_configured": False
        }
    elif connector_type == "linkedin":
        return {
            "client_id": os.getenv("LINKEDIN_CLIENT_ID"),
            "client_secret": os.getenv("LINKEDIN_CLIENT_SECRET"),
            "access_token": os.getenv("LINKEDIN_ACCESS_TOKEN"),
            "is_ui_configured": False
        }
    
    return None


def validate_connector_config(connector_type: str) -> bool:
    """
    Validate if connector has required configuration (from UI or env).
    """
    creds = get_connector_credentials(connector_type)
    if not creds:
        return False
    
    if connector_type == "zendesk":
        return bool(creds.get("subdomain") and creds.get("api_token"))
    elif connector_type == "jira":
        return bool(creds.get("url") and creds.get("api_token"))
    elif connector_type == "salesforce":
        return bool(creds.get("username") and creds.get("password") and creds.get("security_token"))
    elif connector_type == "greenhouse":
        return bool(creds.get("api_key"))
    elif connector_type == "linkedin":
        return bool(creds.get("client_id") and creds.get("client_secret"))
    
    return False

