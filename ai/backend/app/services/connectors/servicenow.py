"""Mock ServiceNow connector"""
from typing import List, Dict

MOCK_INCIDENTS = [
    {"id": "INC001001", "short_description": "Email server down", "state": "New", "priority": "1 - Critical"},
    {"id": "INC001002", "short_description": "VPN connection failed", "state": "In Progress", "priority": "2 - High"}
]

def fetch_incidents() -> List[Dict]:
    return MOCK_INCIDENTS.copy()

def create_incident(short_description: str, description: str, priority: str = "3 - Moderate") -> Dict:
    incident = {
        "id": f"INC001{len(MOCK_INCIDENTS)+100}", 
        "short_description": short_description, 
        "state": "New", 
        "priority": priority
    }
    MOCK_INCIDENTS.append(incident)
    return incident

def get_incident(incident_id: str) -> Dict:
    for inc in MOCK_INCIDENTS:
        if inc["id"] == incident_id:
            return inc
    return None

def update_incident(incident_id: str, updates: Dict) -> Dict:
    for inc in MOCK_INCIDENTS:
        if inc["id"] == incident_id:
            inc.update(updates)
            return inc
    return None

def validate() -> bool:
    return True
