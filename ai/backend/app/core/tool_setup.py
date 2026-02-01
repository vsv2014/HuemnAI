from app.core.tool_registry import register_tool
from app.services import status_service, ticket_service, knowledge_service, hr_service


def register_default_tools():
    # Ticketing tool
    register_tool("ticketing", lambda payload: ticket_service.create_ticket(payload.get("title"), payload.get("body")), metadata={"description": "Create and manage tickets"})
    # Status updater
    register_tool("status_updater", lambda payload: status_service.update_status(payload.get("agent_id"), payload.get("status")), metadata={"description": "Update agent status"})
    # Knowledge search
    register_tool("knowledge", lambda payload: knowledge_service.query_tickets(payload.get("message")), metadata={"description": "Search knowledge/indexed tickets"})
    # HR tool
    register_tool("hr", lambda payload: hr_service.post_job(payload.get("job")), metadata={"description": "HR operations (post job, shortlist)"})
