"""Real Greenhouse connector skeleton - uses UI configuration or environment variables"""
import os
import requests
from typing import List, Dict
from app.services.connector_config_helper import get_connector_credentials, validate_connector_config

BASE = "https://harvest.greenhouse.io/v1"


def _get_credentials():
    """Get credentials from UI config or environment"""
    creds = get_connector_credentials("greenhouse")
    if not creds:
        return None
    return creds.get("api_key")


def validate() -> bool:
    return validate_connector_config("greenhouse")


def post_job(title: str, description: str) -> Dict:
    api_key = _get_credentials()
    if not api_key:
        raise RuntimeError("Greenhouse not configured. Please configure via Settings page.")
    # Implementation placeholder
    return {"id": "JOB-REAL", "title": title, "description": description}


def fetch_candidates() -> List[Dict]:
    # Could call endpoint to list candidates
    return []
