"""
Ticket Solver API - For agents to view and solve assigned tickets
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, asc
from datetime import datetime, timedelta
from app.db.session import get_db
from app.db.models.ticket import Ticket
from app.db.models.subscription import UserAccount
from app.api.auth import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


class ReplyRequest(BaseModel):
    reply_text: str
    attachments: Optional[List[str]] = None


class StatusUpdateRequest(BaseModel):
    status: str  # open, in_progress, resolved, closed


@router.get("/tickets")
async def get_agent_tickets(
    sort_by: str = "priority",  # priority, created_at, sla
    filter_status: str = "all",  # all, open, in_progress, resolved
    include_unassigned: bool = False,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user)
):
    """Get all tickets assigned to the current agent"""
    try:
        # Get user ID (can be email or ID)
        user_id = str(current_user.id) if current_user.id else current_user.email
        
        # Build query
        if include_unassigned:
            query = db.query(Ticket).filter(
                or_(
                    Ticket.assigned_to == user_id,
                    Ticket.assigned_to == None
                )
            )
        else:
            query = db.query(Ticket).filter(
                Ticket.assigned_to == user_id
            )
        
        # Filter by status
        if filter_status != "all":
            query = query.filter(Ticket.status == filter_status)
        
        # Sort
        if sort_by == "priority":
            priority_order = {"urgent": 4, "high": 3, "medium": 2, "low": 1}
            # Sort by priority (custom order)
            tickets = query.all()
            tickets.sort(key=lambda t: priority_order.get(t.priority or "medium", 2), reverse=True)
        elif sort_by == "created_at":
            query = query.order_by(desc(Ticket.created_at))
            tickets = query.all()
        elif sort_by == "sla":
            # Sort by SLA deadline if available (would need to add SLA field to Ticket model)
            query = query.order_by(asc(Ticket.created_at))
            tickets = query.all()
        else:
            tickets = query.all()
        
        # Format response
        ticket_list = []
        for ticket in tickets:
            # Calculate SLA deadline (7 days from creation for now)
            sla_deadline = None
            if ticket.created_at:
                sla_deadline = (ticket.created_at + timedelta(days=7)).isoformat()
            
            ticket_list.append({
                "id": ticket.id,
                "title": ticket.title,
                "description": ticket.description,
                "priority": ticket.priority or "medium",
                "status": ticket.status or "open",
                "assigned_to": ticket.assigned_to,
                "customer_info": ticket.customer_info or {},
                "troubleshooting_steps": ticket.troubleshooting_steps or [],
                "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
                "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None,
                "severity": ticket.severity,
                "sla_deadline": sla_deadline,
                "customer_channel": ticket.customer_channel or (ticket.customer_info.get("channel", "email") if ticket.customer_info else "email"),
                "conversation_history": ticket.conversation_history or [],
                "attachments": ticket.attachments or []
            })
        
        return {
            "success": True,
            "tickets": ticket_list,
            "count": len(ticket_list)
        }
    except Exception as e:
        logger.error(f"Error getting agent tickets: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get tickets: {str(e)}")


@router.get("/tickets/{ticket_id}")
async def get_ticket_details(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user)
):
    """Get detailed information about a specific ticket"""
    try:
        user_id = str(current_user.id) if current_user.id else current_user.email
        
        ticket = db.query(Ticket).filter(
            Ticket.id == ticket_id,
            Ticket.assigned_to == user_id
        ).first()
        
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found or not assigned to you")
        
        # Calculate SLA deadline
        sla_deadline = None
        if ticket.created_at:
            sla_deadline = (ticket.created_at + timedelta(days=7)).isoformat()
        
        return {
            "success": True,
            "ticket": {
                "id": ticket.id,
                "title": ticket.title,
                "description": ticket.description,
                "priority": ticket.priority or "medium",
                "status": ticket.status or "open",
                "assigned_to": ticket.assigned_to,
                "customer_info": ticket.customer_info or {},
                "troubleshooting_steps": ticket.troubleshooting_steps or [],
                "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
                "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None,
                "severity": ticket.severity,
                "sla_deadline": sla_deadline,
                "customer_channel": ticket.customer_channel or (ticket.customer_info.get("channel", "email") if ticket.customer_info else "email"),
                "conversation_history": ticket.conversation_history or [],
                "attachments": ticket.attachments or []
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting ticket details: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get ticket details: {str(e)}")


@router.post("/tickets/{ticket_id}/reply")
async def reply_to_ticket(
    ticket_id: int,
    payload: ReplyRequest,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user)
):
    """Send a reply to the customer for a ticket"""
    try:
        user_id = str(current_user.id) if current_user.id else current_user.email
        
        ticket = db.query(Ticket).filter(
            Ticket.id == ticket_id,
            Ticket.assigned_to == user_id
        ).first()
        
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found or not assigned to you")
        
        # Get or initialize conversation history
        conversation_history = ticket.conversation_history or []
        if not isinstance(conversation_history, list):
            conversation_history = []
        
        # Add agent reply to conversation history
        conversation_history.append({
            "role": "agent",
            "text": payload.reply_text,
            "timestamp": datetime.utcnow().isoformat(),
            "agent_id": user_id,
            "agent_name": current_user.name or current_user.email,
            "attachments": payload.attachments or []
        })
        
        # Update ticket with conversation history
        ticket.conversation_history = conversation_history
        ticket.updated_at = datetime.utcnow()
        
        # Update status to in_progress if it was open
        if ticket.status == "open":
            ticket.status = "in_progress"
        
        db.commit()
        db.refresh(ticket)
        
        # Send reply to customer via communication bridge
        customer_channel = ticket.customer_channel or (ticket.customer_info.get("channel", "email") if ticket.customer_info else "email")
        
        from app.services.communication_bridge import send_reply_to_customer
        bridge_result = send_reply_to_customer(
            ticket_id=ticket_id,
            reply_text=payload.reply_text,
            customer_channel=customer_channel,
            customer_info=ticket.customer_info or {},
            agent_name=current_user.name or current_user.email,
            attachments=payload.attachments
        )
        
        if not bridge_result.get("success"):
            logger.warning(f"Failed to send reply via communication bridge: {bridge_result.get('error')}")
        logger.info(f"Sending reply to customer via {customer_channel} for ticket {ticket_id}")
        
        # In independent mode, we need to implement communication bridge
        # For now, just log it - will be implemented in communication bridge
        
        return {
            "success": True,
            "message": "Reply sent successfully",
            "ticket_id": ticket_id,
            "reply_sent_at": datetime.utcnow().isoformat(),
            "customer_channel": customer_channel
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error replying to ticket: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to send reply: {str(e)}")


@router.put("/tickets/{ticket_id}/status")
async def update_ticket_status(
    ticket_id: int,
    payload: StatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user)
):
    """Update ticket status"""
    try:
        user_id = str(current_user.id) if current_user.id else current_user.email
        
        ticket = db.query(Ticket).filter(
            Ticket.id == ticket_id,
            Ticket.assigned_to == user_id
        ).first()
        
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found or not assigned to you")
        
        if payload.status not in ["open", "in_progress", "resolved", "closed"]:
            raise HTTPException(status_code=400, detail="Invalid status. Must be: open, in_progress, resolved, or closed")
        
        ticket.status = payload.status
        ticket.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(ticket)
        
        return {
            "success": True,
            "message": f"Ticket status updated to {payload.status}",
            "ticket_id": ticket_id,
            "status": ticket.status
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating ticket status: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update status: {str(e)}")

