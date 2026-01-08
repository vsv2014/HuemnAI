from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from app.db.session import get_db
from app.db.models.ticket import Ticket
# User model is in subscription.py as UserAccount
from app.services.status_service import get_agent_status, get_all_agents_status, USER_STATUS
from app.services.agent_router import select_best_agent
from app.api.auth import get_current_user
from app.db.models.subscription import UserAccount
import logging
import time

logger = logging.getLogger(__name__)

router = APIRouter()


class AssignTicketPayload(BaseModel):
    ticket_id: int
    assigned_to: str  # user_id or email


class AutoAssignPayload(BaseModel):
    ticket_id: int


@router.get("/eligible-employees")
async def get_eligible_employees(
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user)
):
    """
    Get list of eligible employees for ticket assignment.
    Returns employees with their status, ticket count, and eligibility.
    """
    try:
        # Get all users (employees)
        users = db.query(UserAccount).filter(UserAccount.is_active == True).all()
        
        eligible_employees = []
        
        for user in users:
            user_id = str(user.id) if user.id else user.email
            
            # Get current status
            status_data = get_agent_status(user_id)
            current_status = status_data.get("status", "offline") if status_data else "offline"
            
            # Get ticket count for this user
            ticket_count = db.query(func.count(Ticket.id)).filter(
                and_(
                    Ticket.assigned_to == user_id,
                    Ticket.status.in_(["open", "in_progress"])
                )
            ).scalar() or 0
            
            # Calculate workload percentage (assuming max 10 tickets per agent)
            max_tickets = 10
            workload_percentage = min((ticket_count / max_tickets) * 100, 100) if max_tickets > 0 else 0
            
            # Determine eligibility based on multiple criteria
            eligibility_reasons = []
            is_eligible = False
            is_available = False
            
            # Criteria 1: Status Check
            if current_status == "offline":
                eligibility_reasons.append("Status: Offline - Not available for ticket assignment")
            elif current_status in ["lunch", "break", "meeting", "training", "leaves"]:
                eligibility_reasons.append(f"Status: {current_status.title()} - Temporarily unavailable")
                # Can still be eligible for urgent tickets if not on leave
                if current_status != "leaves":
                    is_eligible = True  # Can take urgent tickets
            elif current_status == "away":
                eligibility_reasons.append("Status: Away - Limited availability")
                is_eligible = True  # Can take tickets but not preferred
            elif current_status == "busy":
                eligibility_reasons.append("Status: Busy - Can take high/urgent priority tickets")
                is_eligible = True
            elif current_status == "online":
                eligibility_reasons.append("Status: Online - Fully available")
                is_eligible = True
                is_available = True
            else:
                eligibility_reasons.append(f"Status: {current_status} - Unknown status")
            
            # Criteria 2: Workload Check
            if is_eligible:
                if workload_percentage >= 100:
                    eligibility_reasons.append("Workload: At maximum capacity (100%+)")
                    is_eligible = False
                    is_available = False
                elif workload_percentage >= 90:
                    eligibility_reasons.append("Workload: Near maximum (90%+) - Only for urgent tickets")
                    is_available = False  # Not fully available but can take urgent
                elif workload_percentage >= 70:
                    eligibility_reasons.append("Workload: High (70%+) - Prefer lower workload agents")
                    is_available = False
                elif workload_percentage >= 50:
                    eligibility_reasons.append("Workload: Moderate (50%+) - Available")
                else:
                    eligibility_reasons.append("Workload: Low - Optimal for assignment")
            
            # Criteria 3: Activity Check (if status data available)
            if status_data:
                last_seen = status_data.get("last_seen", 0)
                time_since_seen = time.time() - last_seen if last_seen > 0 else float('inf')
                
                if time_since_seen > 3600:  # More than 1 hour
                    eligibility_reasons.append("Activity: Inactive for >1 hour")
                    is_available = False
                elif time_since_seen > 1800:  # More than 30 minutes
                    eligibility_reasons.append("Activity: Inactive for >30 minutes")
                    is_available = False
                elif time_since_seen < 300:  # Active in last 5 minutes
                    eligibility_reasons.append("Activity: Recently active")
                else:
                    eligibility_reasons.append("Activity: Moderately active")
            
            # Calculate eligibility score (0-100)
            eligibility_score = 0
            if current_status == "online":
                eligibility_score += 40
            elif current_status == "busy":
                eligibility_score += 25
            elif current_status == "away":
                eligibility_score += 10
            
            if workload_percentage < 50:
                eligibility_score += 30
            elif workload_percentage < 70:
                eligibility_score += 20
            elif workload_percentage < 90:
                eligibility_score += 10
            
            if status_data:
                last_seen = status_data.get("last_seen", 0)
                time_since_seen = time.time() - last_seen if last_seen > 0 else float('inf')
                if time_since_seen < 300:  # Active in last 5 minutes
                    eligibility_score += 20
                elif time_since_seen < 1800:  # Active in last 30 minutes
                    eligibility_score += 10
            
            eligible_employees.append({
                "id": user_id,
                "name": user.name or user.email,
                "email": user.email,
                "status": current_status,
                "ticket_count": ticket_count,
                "max_tickets": max_tickets,
                "workload_percentage": round(workload_percentage, 1),
                "is_eligible": is_eligible,
                "is_available": is_available,
                "eligibility_score": min(eligibility_score, 100),
                "eligibility_reasons": eligibility_reasons,
                "last_seen": status_data.get("last_seen", 0) if status_data else 0,
            })
        
        # Sort by: eligibility score (descending), then by availability, then by ticket count
        eligible_employees.sort(key=lambda x: (
            -x.get("eligibility_score", 0),  # Higher score first
            not x["is_available"],  # Available first
            x["ticket_count"]  # Lower ticket count first
        ))
        
        return {
            "success": True,
            "employees": eligible_employees,
            "total": len(eligible_employees),
            "available_count": sum(1 for e in eligible_employees if e["is_available"]),
            "eligible_count": sum(1 for e in eligible_employees if e["is_eligible"]),
        }
    except Exception as e:
        logger.error(f"Error getting eligible employees: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get eligible employees: {str(e)}")


@router.get("/pending-tickets")
async def get_pending_tickets(
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
    unassigned_only: bool = False
):
    """
    Get list of pending tickets that need assignment.
    """
    try:
        query = db.query(Ticket).filter(
            Ticket.status.in_(["open", "in_progress"])
        )
        
        if unassigned_only:
            query = query.filter(Ticket.assigned_to == None)
        
        tickets = query.order_by(
            Ticket.created_at.desc()
        ).limit(50).all()
        
        ticket_list = []
        for ticket in tickets:
            assigned_agent_status = None
            if ticket.assigned_to:
                status_data = get_agent_status(ticket.assigned_to)
                if status_data:
                    assigned_agent_status = status_data.get("status", "offline")
            
            ticket_list.append({
                "id": ticket.id,
                "title": ticket.title or "Untitled Ticket",
                "description": ticket.description or "",
                "priority": ticket.priority or "medium",
                "status": ticket.status,
                "assigned_to": ticket.assigned_to,
                "assigned_agent_status": assigned_agent_status,
                "connector_type": ticket.connector_type,
                "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
                "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None,
            })
        
        return {
            "success": True,
            "tickets": ticket_list,
            "total": len(ticket_list),
            "unassigned_count": sum(1 for t in ticket_list if not t["assigned_to"]),
        }
    except Exception as e:
        logger.error(f"Error getting pending tickets: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get pending tickets: {str(e)}")


@router.post("/assign")
async def assign_ticket(
    payload: AssignTicketPayload,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user)
):
    """
    Manually assign a ticket to a specific employee.
    """
    try:
        ticket = db.query(Ticket).filter(Ticket.id == payload.ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Verify employee exists and is eligible
        user = db.query(UserAccount).filter(
            (UserAccount.id == payload.assigned_to) | (UserAccount.email == payload.assigned_to)
        ).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        user_id = str(user.id) if user.id else user.email
        
        # Check if employee is eligible (optional - can still assign even if offline)
        status_data = get_agent_status(user_id)
        current_status = status_data.get("status", "offline") if status_data else "offline"
        
        # Assign ticket
        ticket.assigned_to = user_id
        ticket.status = "in_progress" if ticket.status == "open" else ticket.status
        db.commit()
        
        logger.info(f"Ticket {payload.ticket_id} assigned to {user_id} by {current_user.email}")
        
        return {
            "success": True,
            "message": f"Ticket #{payload.ticket_id} assigned to {user.name or user.email}",
            "ticket_id": payload.ticket_id,
            "assigned_to": user_id,
            "assigned_to_name": user.name or user.email,
            "agent_status": current_status,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error assigning ticket: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to assign ticket: {str(e)}")


@router.post("/auto-assign")
async def auto_assign_ticket(
    payload: AutoAssignPayload,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user)
):
    """
    Automatically assign a ticket to the best available employee.
    Uses the same logic as select_best_agent but returns more details.
    """
    try:
        ticket = db.query(Ticket).filter(Ticket.id == payload.ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Use existing agent router logic
        best_agent_id = select_best_agent(
            priority=ticket.priority or "medium",
            required_skills=None  # Can be enhanced later
        )
        
        if not best_agent_id:
            return {
                "success": False,
                "message": "No eligible employees available for assignment",
                "ticket_id": payload.ticket_id,
            }
        
        # Get agent details
        user = db.query(UserAccount).filter(
            (UserAccount.id == best_agent_id) | (UserAccount.email == best_agent_id)
        ).first()
        
        if not user:
            # Fallback: use the ID directly
            user_id = best_agent_id
            user_name = best_agent_id
        else:
            user_id = str(user.id) if user.id else user.email
            user_name = user.name or user.email
        
        # Assign ticket
        ticket.assigned_to = user_id
        ticket.status = "in_progress" if ticket.status == "open" else ticket.status
        db.commit()
        
        # Get agent status
        status_data = get_agent_status(user_id)
        current_status = status_data.get("status", "offline") if status_data else "offline"
        
        # Get agent's current ticket count
        ticket_count = db.query(func.count(Ticket.id)).filter(
            and_(
                Ticket.assigned_to == user_id,
                Ticket.status.in_(["open", "in_progress"])
            )
        ).scalar() or 0
        
        logger.info(f"Auto-assigned ticket {payload.ticket_id} to {user_id} by {current_user.email}")
        
        return {
            "success": True,
            "message": f"Ticket #{payload.ticket_id} automatically assigned to {user_name}",
            "ticket_id": payload.ticket_id,
            "assigned_to": user_id,
            "assigned_to_name": user_name,
            "agent_status": current_status,
            "agent_ticket_count": ticket_count,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error auto-assigning ticket: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to auto-assign ticket: {str(e)}")

