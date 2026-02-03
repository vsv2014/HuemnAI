"""Mock Zoho CRM connector"""
from typing import List, Dict

MOCK_LEADS = [
    {"id": "zg_1001", "Last_Name": "Williams", "Company": "Acme Corp", "Email": "williams@acme.com", "Status": "Contacted"},
    {"id": "zg_1002", "Last_Name": "Brown", "Company": "TechStart", "Email": "brown@techstart.io", "Status": "Not Contacted"}
]

def fetch_leads() -> List[Dict]:
    return MOCK_LEADS.copy()

def create_lead(last_name: str, company: str, email: str) -> Dict:
    lead = {
        "id": f"zg_{len(MOCK_LEADS)+1003}",
        "Last_Name": last_name,
        "Company": company,
        "Email": email,
        "Status": "Not Contacted"
    }
    MOCK_LEADS.append(lead)
    return lead

def convert_lead(lead_id: str) -> Dict:
    # Mock conversion to Contact/Account/Deal
    return {"success": True, "contact_id": f"zc_{lead_id}", "account_id": f"za_{lead_id}", "deal_id": f"zd_{lead_id}"}


def update_potential(potential_id: str, stage: str, amount: float = None) -> Dict:
    return {"id": potential_id, "stage": stage, "amount": amount or 10000.0, "updated": True}


def get_account(account_id: str) -> Dict:
    return {"id": account_id, "Account_Name": "Acme Inc", "Industry": "Software", "Annual_Revenue": 5000000}


def validate() -> bool:
    return True
