"""Mock Jira connector"""
from typing import List, Dict

MOCK_TICKETS = [
    {"id": "JIRA-1", "title": "Login failure", "body": "User cannot login after password reset", "status": "done"},
    {"id": "JIRA-2", "title": "Payment error", "body": "Payment failed for order 123", "status": "open"},
]


def fetch_tickets() -> List[Dict]:
    # Simulate fetching tickets from Jira
    return MOCK_TICKETS.copy()


def create_ticket(title: str, body: str) -> Dict:
    ticket = {"id": f"JIRA-{len(MOCK_TICKETS)+1}", "title": title, "body": body, "status": "open"}
    MOCK_TICKETS.append(ticket)
    return ticket


def validate() -> bool:
    """Mock connector always considered available in dev/testing."""
    return True
