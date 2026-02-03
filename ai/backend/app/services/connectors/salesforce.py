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


def update_case(case_id: str, updates: Dict) -> Dict:
    for case in MOCK_CASES:
        if case["id"] == case_id:
            case.update(updates)
            return case
    return None


def search_cases(query: str) -> List[Dict]:
    query = query.lower()
    return [c for c in MOCK_CASES if query in c["subject"].lower() or query in c["description"].lower()]



def validate() -> bool:
    return True
