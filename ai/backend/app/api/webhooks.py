"""
Webhook endpoints for receiving tickets from external systems (Zendesk, Jira, etc.)
All incoming tickets are routed through Customer Service for analysis and processing.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, List
from app.services.ticket_analyzer import (
    find_similar_tickets,
    generate_response_from_history,
    check_user_impact,
    adjust_severity_based_on_impact
)
from app.services.ticket_service import (
    create_ticket_with_template,
    detect_issue_type,
    determine_severity
)
from app.db.session import SessionLocal
from app.db.models.ticket import Ticket
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class ExternalTicketPayload(BaseModel):
    """Payload from external ticketing systems"""
    external_id: str
    connector_type: str  # zendesk, jira, salesforce, etc.
    title: str
    description: str
    priority: Optional[str] = None
    status: Optional[str] = None
    requester_email: Optional[str] = None
    requester_name: Optional[str] = None
    metadata: Optional[Dict] = None


@router.post("/ticket-incoming")
async def receive_external_ticket(payload: ExternalTicketPayload):
    """
    Receive ticket from external system (Zendesk, Jira, etc.)
    This endpoint processes incoming tickets and routes them through Customer Service
    for analysis, similarity checking, and intelligent response generation.
    """
    try:
        # Step 1: Find similar previous tickets
        query_text = f"{payload.title} {payload.description}"
        similar_tickets = find_similar_tickets(query_text, limit=5, min_similarity=0.7)
        
        # Step 2: Generate response based on history
        history_response = generate_response_from_history(
            query_text,
            similar_tickets,
            conversation_history=[]
        )
        
        # Step 3: Detect issue type and determine severity
        issue_type = detect_issue_type(payload.description)
        severity = determine_severity(payload.description)
        
        # Step 4: Check user impact for high severity tickets
        impact_assessment = check_user_impact(payload.description)
        
        # Step 5: Adjust severity if needed
        adjusted_severity = severity
        severity_reason = ""
        if severity == "high":
            adjusted_severity, severity_reason = adjust_severity_based_on_impact(
                severity,
                impact_assessment
            )
        
        # Step 6: Create ticket in our system (but don't assign yet - goes through Customer Service)
        db = SessionLocal()
        try:
            # Check if ticket already exists
            existing = db.query(Ticket).filter(
                Ticket.external_ticket_id == payload.external_id,
                Ticket.connector_type == payload.connector_type
            ).first()
            
            if existing:
                # Update existing ticket
                existing.title = payload.title
                existing.description = payload.description
                existing.priority = adjusted_severity
                existing.status = "open"
                db.commit()
                db.refresh(existing)
                ticket = existing
            else:
                # Create new ticket
                ticket = Ticket(
                    title=payload.title,
                    description=payload.description,
                    priority=adjusted_severity,
                    status="open",
                    connector_type=payload.connector_type,
                    external_ticket_id=payload.external_id,
                    customer_info={
                        "requester_email": payload.requester_email,
                        "requester_name": payload.requester_name,
                        "metadata": payload.metadata or {},
                        "similar_tickets": [t["ticket_id"] for t in similar_tickets[:3]],
                        "history_response": history_response,
                        "impact_assessment": impact_assessment
                    }
                )
                db.add(ticket)
                db.commit()
                db.refresh(ticket)
        finally:
            db.close()
        
        # Step 7: Determine if we should ask questions or provide immediate response
        suggested_questions = []
        if history_response.get("is_similar") and history_response.get("confidence", 0) >= 0.9:
            # Very similar - can provide solution
            response_text = history_response.get("response", "")
        elif history_response.get("is_similar"):
            # Similar but need clarification
            suggested_questions = history_response.get("suggested_questions", [])
            response_text = history_response.get("response", "I've seen a similar issue before. Let me ask a few questions to help you better.")
        else:
            # New issue - use template questions
            from app.services.ticket_service import get_ticket_template
            template = get_ticket_template(issue_type)
            suggested_questions = template.get("questions", [])[:3]  # First 3 questions
            response_text = "Thank you for contacting us. I'll help you resolve this issue. Let me gather some information first."
        
        return {
            "success": True,
            "ticket_id": ticket.id,
            "message": response_text,
            "similar_tickets_found": len(similar_tickets),
            "similar_ticket_ids": [t["ticket_id"] for t in similar_tickets[:3]],
            "is_similar_issue": history_response.get("is_similar", False),
            "confidence": history_response.get("confidence", 0.0),
            "suggested_questions": suggested_questions,
            "severity": adjusted_severity,
            "severity_adjustment": severity_reason if severity_reason else None,
            "user_impact": impact_assessment.get("has_user_impact", False),
            "issue_type": issue_type,
            "next_steps": "ticket_routed_to_customer_service"
        }
    
    except Exception as e:
        logger.error(f"Error processing external ticket: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process ticket: {str(e)}")


@router.post("/zendesk-webhook")
async def zendesk_webhook(request: Request):
    """
    Webhook endpoint specifically for Zendesk.
    Zendesk sends webhooks in a specific format.
    """
    try:
        data = await request.json()
        
        # Extract ticket data from Zendesk webhook format
        ticket_data = data.get("ticket", {})
        
        payload = ExternalTicketPayload(
            external_id=str(ticket_data.get("id", "")),
            connector_type="zendesk",
            title=ticket_data.get("subject", "No Subject"),
            description=ticket_data.get("description", ""),
            priority=ticket_data.get("priority", "normal"),
            status=ticket_data.get("status", "new"),
            requester_email=ticket_data.get("requester", {}).get("email") if isinstance(ticket_data.get("requester"), dict) else None,
            requester_name=ticket_data.get("requester", {}).get("name") if isinstance(ticket_data.get("requester"), dict) else None,
            metadata={"zendesk_data": ticket_data}
        )
        
        return await receive_external_ticket(payload)
    
    except Exception as e:
        logger.error(f"Error processing Zendesk webhook: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Invalid webhook data: {str(e)}")


@router.post("/jira-webhook")
async def jira_webhook(request: Request):
    """
    Webhook endpoint specifically for Jira.
    """
    try:
        data = await request.json()
        
        # Extract issue data from Jira webhook format
        issue = data.get("issue", {})
        fields = issue.get("fields", {})
        
        payload = ExternalTicketPayload(
            external_id=issue.get("key", ""),
            connector_type="jira",
            title=fields.get("summary", "No Summary"),
            description=fields.get("description", ""),
            priority=fields.get("priority", {}).get("name", "medium") if isinstance(fields.get("priority"), dict) else "medium",
            status=fields.get("status", {}).get("name", "open") if isinstance(fields.get("status"), dict) else "open",
            requester_email=fields.get("reporter", {}).get("emailAddress") if isinstance(fields.get("reporter"), dict) else None,
            requester_name=fields.get("reporter", {}).get("displayName") if isinstance(fields.get("reporter"), dict) else None,
            metadata={"jira_data": issue}
        )
        
        return await receive_external_ticket(payload)
    
    except Exception as e:
        logger.error(f"Error processing Jira webhook: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Invalid webhook data: {str(e)}")

