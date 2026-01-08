"""Real Zendesk connector skeleton - uses UI configuration or environment variables"""
import os
import requests
from typing import List, Dict
from app.services.connector_config_helper import get_connector_credentials, validate_connector_config


def _get_credentials():
    """Get credentials from UI config or environment"""
    creds = get_connector_credentials("zendesk")
    if not creds:
        return None, None
    return creds.get("subdomain"), creds.get("api_token")


def validate() -> bool:
    return validate_connector_config("zendesk")


def _auth_headers():
    _, token = _get_credentials()
    if not token:
        return {}
    return {"Authorization": f"Bearer {token}"}


def fetch_tickets() -> List[Dict]:
    subdomain, _ = _get_credentials()
    if not subdomain:
        return []
    try:
        resp = requests.get(f"https://{subdomain}.zendesk.com/api/v2/tickets.json", headers=_auth_headers(), timeout=10)
        resp.raise_for_status()
        data = resp.json()
        tickets = data.get("tickets", [])
        out = [{"id": t.get("id"), "title": t.get("subject"), "body": t.get("description"), "status": t.get("status")} for t in tickets]
        return out
    except Exception:
        return []


def create_ticket(title: str, body: str) -> Dict:
    subdomain, _ = _get_credentials()
    if not subdomain:
        raise RuntimeError("Zendesk not configured. Please configure via Settings page.")
    payload = {"ticket": {"subject": title, "comment": {"body": body}}}
    resp = requests.post(f"https://{subdomain}.zendesk.com/api/v2/tickets.json", json=payload, headers=_auth_headers(), timeout=10)
    resp.raise_for_status()
    return resp.json()