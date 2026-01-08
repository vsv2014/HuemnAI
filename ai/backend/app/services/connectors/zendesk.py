"""Mock Zendesk connector"""
from typing import List, Dict

MOCK_TICKETS = [
    {"id": "ZD-101", "title": "Email not received", "body": "Customer didn't get confirmation email", "status": "open"},
]


def fetch_tickets() -> List[Dict]:
    return MOCK_TICKETS.copy()


def create_ticket(title: str, body: str) -> Dict:
    ticket = {"id": f"ZD-{len(MOCK_TICKETS)+101}", "title": title, "body": body, "status": "open"}
    MOCK_TICKETS.append(ticket)
    return ticket


def validate() -> bool:
    return True
