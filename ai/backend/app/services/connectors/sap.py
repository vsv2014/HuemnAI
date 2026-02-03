"""Mock SAP connector (ECC/S4HANA)"""
from typing import List, Dict

MOCK_ORDERS = [
    {"id": "4500001234", "type": "Standard Order", "customer": "1000", "amount": 5000.00, "currency": "USD", "status": "Created"},
    {"id": "4500001235", "type": "Rush Order", "customer": "1002", "amount": 1200.00, "currency": "EUR", "status": "Shipped"}
]

def fetch_orders(customer_id: str = None) -> List[Dict]:
    if customer_id:
        return [o for o in MOCK_ORDERS if o["customer"] == customer_id]
    return MOCK_ORDERS.copy()

def create_sales_order(customer_id: str, items: List[Dict]) -> Dict:
    order_id = f"450000{len(MOCK_ORDERS)+1236}"
    total = sum(item.get("price", 0) * item.get("quantity", 1) for item in items)
    order = {
        "id": order_id,
        "type": "Standard Order",
        "customer": customer_id,
        "amount": total,
        "currency": "USD",
        "status": "Created"
    }
    MOCK_ORDERS.append(order)
    return order

def check_inventory(material_id: str, plant: str) -> Dict:
    return {"material": material_id, "plant": plant, "quantity": 150, "unit": "PC"}


def get_inventory(material_id: str, plant: str) -> Dict:
    return check_inventory(material_id, plant)


def update_delivery(delivery_id: str, status: str) -> Dict:
    return {"id": delivery_id, "status": status, "updated": True}


def validate() -> bool:
    return True
