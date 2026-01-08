"""Mock Salesforce connector"""
from typing import List, Dict

MOCK_CASES = [
    {"id": "SF-1", "subject": "Integration failure", "description": "Webhook failing intermittently", "status": "open"}
]


def fetch_cases() -> List[Dict]:
    return MOCK_CASES.copy()


def create_case(subject: str, description: str) -> Dict:
    case = {"id": f"SF-{len(MOCK_CASES)+1}", "subject": subject, "description": description, "status": "open"}
    MOCK_CASES.append(case)
    return case


def validate() -> bool:
    return True
