from typing import List, Optional, Dict, Any
import importlib
from app.services import connectors
from app.core.tool_registry import save_config, register_tool, get_tool
import logging

logger = logging.getLogger(__name__)

# Connector registry
CONNECTOR_REGISTRY: Dict[str, Any] = {}


def get_connector(connector_type: str) -> Optional[Any]:
    """Get a connector module by type (jira, zendesk, salesforce, etc.)"""
    if connector_type in CONNECTOR_REGISTRY:
        return CONNECTOR_REGISTRY[connector_type]
    
    # Try to get from connectors module
    try:
        module = getattr(connectors, connector_type, None)
        if module:
            CONNECTOR_REGISTRY[connector_type] = module
            return module
    except Exception as e:
        logger.warning(f"Error getting connector {connector_type}: {e}")
    
    return None


def discover_and_enable_connectors():
    """Discover available connectors and enable their tools if credentials are valid.

    For each connector module exported by `app.services.connectors`, call its `validate()`
    function if present, otherwise try a lightweight heuristics (env-var presence).
    If validation passes, create or enable a corresponding tool config entry named `connector:{name}`.
    """
    connector_names = ["jira", "zendesk", "salesforce", "servicenow", "sap", "hubspot", "zoho", "greenhouse", "linkedin"]
    
    for name in connector_names:
        try:
            module = getattr(connectors, name, None)
            if module is None:
                continue
            
            validate = getattr(module, "validate", None)
            ok = False
            if callable(validate):
                ok = bool(validate())
            else:
                # fallback: check if module defines at least one expected env-driven var
                ok = any(hasattr(module, attr) and getattr(module, attr) for attr in ("BASE", "TOKEN", "USER"))
            
            if ok:
                # Register connector
                CONNECTOR_REGISTRY[name] = module
                
                # enable connector tool config
                tool_name = f"connector:{name}"
                # ensure a runtime entry exists
                register_tool(tool_name, lambda payload, n=name: None, metadata={"connector": name})
                save_config(tool_name, enabled=True, mode="auto", settings={"connector": name})
                logger.info("Enabled connector %s as tool %s", name, tool_name)
        except Exception as e:
            logger.exception("Error while validating connector %s: %s", name, e)

def get_connector_metadata() -> List[Dict[str, Any]]:
    """Return metadata for all available connectors (actions, params).
    This serves as the source of truth for the Frontend UI.
    """
    return [
        {
            "type": "salesforce",
            "name": "Salesforce",
            "icon": "salesforce",
            "actions": [
                {"name": "create_case", "label": "Create Case", "description": "Create a new support case", "params": {"subject": "string", "description": "string", "priority": "string"}},
                {"name": "update_case", "label": "Update Case", "description": "Update an existing case", "params": {"case_id": "string", "data": "json"}},
                {"name": "search_cases", "label": "Search Cases", "description": "Search for cases using SOQL", "params": {"query": "string"}}
            ]
        },
        {
            "type": "servicenow",
            "name": "ServiceNow",
            "icon": "servicenow",
            "actions": [
                {"name": "create_incident", "label": "Create Incident", "description": "Create a new incident", "params": {"short_description": "string", "description": "string", "urgency": "number"}},
                {"name": "update_incident", "label": "Update Incident", "description": "Update an existing incident", "params": {"sys_id": "string", "data": "json"}},
                {"name": "get_incident", "label": "Get Incident", "description": "Get incident details", "params": {"sys_id": "string"}}
            ]
        },
        {
            "type": "sap",
            "name": "SAP",
            "icon": "sap",
            "actions": [
                {"name": "create_sales_order", "label": "Create Sales Order", "description": "Create a new sales order", "params": {"order_data": "json"}},
                {"name": "get_sales_order", "label": "Get Sales Order", "description": "Get sales order details", "params": {"order_id": "string"}}
            ]
        },
        {
            "type": "hubspot",
            "name": "HubSpot",
            "icon": "hubspot",
            "actions": [
                {"name": "create_contact", "label": "Create Contact", "description": "Create a new contact", "params": {"properties": "json"}},
                {"name": "get_contact", "label": "Get Contact", "description": "Get contact details", "params": {"contact_id": "string"}}
            ]
        },
        {
            "type": "zoho",
            "name": "Zoho",
            "icon": "zoho",
            "actions": [
                {"name": "create_lead", "label": "Create Lead", "description": "Create a new lead", "params": {"data": "json"}},
                {"name": "get_lead", "label": "Get Lead", "description": "Get lead details", "params": {"lead_id": "string"}}
            ]
        },
        {
            "type": "jira",
            "name": "Jira",
            "icon": "jira",
            "actions": [
                {"name": "create_ticket", "label": "Create Ticket", "description": "Create a new Jira issue", "params": {"title": "string", "body": "string"}},
                {"name": "fetch_tickets", "label": "Fetch Tickets", "description": "Fetch recent tickets", "params": {}},
                {"name": "get_ticket", "label": "Get Ticket", "description": "Get ticket details", "params": {"ticket_id": "string"}},
                {"name": "update_ticket", "label": "Update Ticket", "description": "Update ticket fields", "params": {"ticket_id": "string", "data": "json"}}
            ]
        },
        {
            "type": "zendesk",
            "name": "Zendesk",
            "icon": "zendesk",
            "actions": [
                {"name": "create_ticket", "label": "Create Ticket", "description": "Create a new ticket", "params": {"title": "string", "body": "string"}},
                {"name": "fetch_tickets", "label": "Fetch Tickets", "description": "Fetch recent tickets", "params": {}},
                {"name": "get_ticket", "label": "Get Ticket", "description": "Get ticket details", "params": {"ticket_id": "string"}},
                {"name": "update_ticket", "label": "Update Ticket", "description": "Update ticket", "params": {"ticket_id": "string", "data": "json"}}
            ]
        }
    ]
