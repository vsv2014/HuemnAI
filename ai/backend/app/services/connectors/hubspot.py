"""Mock HubSpot connector"""
from typing import List, Dict

MOCK_CONTACTS = [
    {"id": "101", "firstname": "John", "lastname": "Doe", "email": "john@example.com", "lifecycle_stage": "lead"},
    {"id": "102", "firstname": "Jane", "lastname": "Smith", "email": "jane@example.com", "lifecycle_stage": "customer"}
]

MOCK_DEALS = [
    {"id": "5001", "dealname": "Big Enterprise Deal", "amount": 50000, "stage": "contract_sent"},
    {"id": "5002", "dealname": "Small Business Starter", "amount": 1500, "stage": "closed_won"}
]

def search_contacts(query: str) -> List[Dict]:
    query = query.lower()
    return [c for c in MOCK_CONTACTS if query in c["email"].lower() or query in c["firstname"].lower()]

def create_contact(email: str, firstname: str, lastname: str) -> Dict:
    contact = {
        "id": str(len(MOCK_CONTACTS) + 103),
        "firstname": firstname,
        "lastname": lastname,
        "email": email,
        "lifecycle_stage": "lead"
    }
    MOCK_CONTACTS.append(contact)
    return contact

def get_deal(deal_id: str) -> Dict:
    for d in MOCK_DEALS:
        if d["id"] == deal_id:
            return d
    return None


def update_deal(deal_id: str, properties: Dict) -> Dict:
    deal = get_deal(deal_id)
    if deal:
        deal.update(properties)
        return deal
    return None


def search_companies(domain: str) -> List[Dict]:
    return [{"id": "123456", "name": "Acme Corp", "domain": domain, "industry": "Technology"}]


def validate() -> bool:
    return True
