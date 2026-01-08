from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.ticket_service import (
    create_ticket_with_info,
    get_ticket,
    update_ticket_status
)
from app.services.agent_router import select_best_agent, reassign_ticket_if_needed

router = APIRouter()


class CreateTicketPayload(BaseModel):
    title: str
    description: str
    priority: str = "medium"
    connector_type: Optional[str] = None
    customer_info: Optional[dict] = None


class ReassignTicketPayload(BaseModel):
    ticket_id: int


@router.post("/")
async def create_ticket_endpoint(payload: CreateTicketPayload):
    """Create a new ticket and assign to best agent"""
    try:
        ticket = create_ticket_with_info(
            title=payload.title,
            description=payload.description,
            customer_info=payload.customer_info,
            connector_type=payload.connector_type,
            priority=payload.priority
        )
        return {
            "success": True,
            "ticket": {
                "id": ticket.id,
                "title": ticket.title,
                "assigned_to": ticket.assigned_to,
                "status": ticket.status,
                "priority": ticket.priority
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{ticket_id}")
async def get_ticket_endpoint(ticket_id: int):
    """Get ticket details"""
    ticket = get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {
        "id": ticket.id,
        "title": ticket.title,
        "description": ticket.description,
        "status": ticket.status,
        "priority": ticket.priority,
        "assigned_to": ticket.assigned_to,
        "customer_info": ticket.customer_info,
        "troubleshooting_steps": ticket.troubleshooting_steps,
        "created_at": ticket.created_at.isoformat() if ticket.created_at else None
    }


@router.post("/{ticket_id}/reassign")
async def reassign_ticket_endpoint(ticket_id: int):
    """
    Reassign ticket to best available agent.
    Part of the Ticket Assigner tool.
    """
    new_agent = reassign_ticket_if_needed(ticket_id)
    if new_agent:
        return {
            "success": True,
            "reassigned": True,
            "new_agent": new_agent,
            "ticket_id": ticket_id
        }
    else:
        return {
            "success": True,
            "reassigned": False,
            "message": "Ticket assignment is still optimal",
            "ticket_id": ticket_id
        }


@router.post("/{ticket_id}/status")
async def update_ticket_status_endpoint(ticket_id: int, status: str):
    """Update ticket status"""
    ticket = update_ticket_status(ticket_id, status)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {
        "success": True,
        "ticket_id": ticket_id,
        "status": ticket.status
    }

