from typing import List, Optional, Dict, Any
import importlib
from app.services import connectors
from app.core.tool_registry import save_config, register_tool, get_tool
from app.core.config import settings
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
    """Register only actual, explicitly enabled connector dispatchers.

    A module-level validate() proves neither user authorization nor an
    executable, production-capable tool. Mock/demo modules must not become
    auto-enabled tools, and a placeholder handler must never report success.
    """
    if not settings.USE_REAL_CONNECTORS:
        logger.info("Real connectors disabled; demo connectors are never auto-enabled")
        return

    for name in ("jira", "zendesk", "salesforce", "servicenow", "sap",
                 "hubspot", "zoho", "greenhouse", "linkedin"):
        module = getattr(connectors, name, None)
        if module is None:
            continue
        # Only a validated, generic *read-only* dispatch contract may be
        # registered automatically. Writes require separately scoped action
        # authorization and human confirmation.
        validate = getattr(module, "validate", None)
        dispatch = getattr(module, "execute_read_only", None)
        if not callable(validate) or not callable(dispatch):
            logger.info("Connector %s is present but not certified for tool execution", name)
            continue
        try:
            if not validate():
                continue
        except Exception:
            logger.warning("Connector validation failed: %s", name, exc_info=True)
            continue
        # Registered but disabled: credential validation is not user consent.
        register_tool(
            f"connector:{name}",
            lambda payload, fn=dispatch: fn(payload or {}),
            metadata={"connector": name, "side_effects": False, "requires_auth": True},
        )
        logger.info("Registered read-only connector %s; explicit admin enablement required", name)


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
