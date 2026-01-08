"""Real Salesforce connector skeleton - uses UI configuration or environment variables"""
import os
import requests
from typing import List, Dict
from app.services.connector_config_helper import get_connector_credentials, validate_connector_config


def _get_credentials():
    """Get credentials from UI config or environment"""
    creds = get_connector_credentials("salesforce")
    if not creds:
        return None, None, None
    return creds.get("username"), creds.get("password"), creds.get("security_token")


def validate() -> bool:
    return validate_connector_config("salesforce")


def _auth_headers():
    # Placeholder - implement token refresh with UI-configured credentials
    username, password, security_token = _get_credentials()
    if not username or not password:
        return {}
    # TODO: Implement OAuth2 flow with UI-configured credentials
    return {}


def fetch_cases() -> List[Dict]:
    if not INSTANCE_URL:
        return []
    try:
        resp = requests.get(f"{INSTANCE_URL}/services/data/v52.0/query?q=SELECT+Id,Subject,Description,Status+FROM+Case", headers=_auth_headers(), timeout=10)
        resp.raise_for_status()
        data = resp.json()
        records = data.get("records", [])
        out = [{"id": r.get("Id"), "subject": r.get("Subject"), "description": r.get("Description"), "status": r.get("Status")} for r in records]
        return out
    except Exception:
        return []


def create_case(subject: str, description: str) -> Dict:
    raise NotImplementedError("Salesforce case creation should be implemented with auth flow")