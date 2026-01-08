"""Real Jira connector skeleton - uses UI configuration or environment variables"""
import os
import requests
from typing import List, Dict
from app.services.connector_config_helper import get_connector_credentials, validate_connector_config
import base64


def _get_credentials():
    """Get credentials from UI config or environment"""
    creds = get_connector_credentials("jira")
    if not creds:
        return None, None, None
    return creds.get("url"), creds.get("email"), creds.get("api_token")


def validate() -> bool:
    return validate_connector_config("jira")


def _auth_headers():
    _, email, token = _get_credentials()
    if not email or not token:
        return {}
    # Jira uses Basic auth with email:token
    auth_string = f"{email}:{token}"
    auth_bytes = auth_string.encode('ascii')
    auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
    return {"Authorization": f"Basic {auth_b64}"}


def fetch_tickets() -> List[Dict]:
    base_url, _, _ = _get_credentials()
    if not base_url:
        return []
    # Example: GET /rest/api/2/search?jql=
    try:
        resp = requests.get(f"{base_url}/rest/api/2/search?jql=project=YOURPROJECT", headers=_auth_headers(), timeout=10)
        resp.raise_for_status()
        data = resp.json()
        issues = data.get("issues", [])
        out = []
        for i in issues:
            out.append({"id": i.get("key"), "title": i.get("fields", {}).get("summary"), "body": i.get("fields", {}).get("description"), "status": i.get("fields", {}).get("status", {}).get("name")})
        return out
    except Exception:
        return []


def create_ticket(title: str, body: str) -> Dict:
    base_url, _, _ = _get_credentials()
    if not base_url:
        raise RuntimeError("Jira not configured. Please configure via Settings page.")
    # Implement ticket creation logic with API
    payload = {"fields": {"project": {"key": "YOURPROJECT"}, "summary": title, "description": body, "issuetype": {"name": "Task"}}}
    resp = requests.post(f"{base_url}/rest/api/2/issue", json=payload, headers=_auth_headers(), timeout=10)
    resp.raise_for_status()
    return resp.json()