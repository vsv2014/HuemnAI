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
from app.db.models.subscription import UserAccount, Subscription, SubscriptionPlan
from app.core.config import settings
from datetime import datetime, timedelta
import stripe
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


# ---------------- STRIPE WEBHOOK ----------------

@router.post("/stripe")
async def stripe_webhook(request: Request):
    """
    Handle Stripe webhooks for subscription events
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        # Invalid payload
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle the event
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        await handle_checkout_completed(session)
    elif event["type"] == "invoice.payment_succeeded":
        # Handle recurring payment success
        invoice = event["data"]["object"]
        await handle_invoice_payment_succeeded(invoice)
    elif event["type"] == "invoice.payment_failed":
        # Handle payment failure (e.g., email user)
        invoice = event["data"]["object"]
        await handle_invoice_payment_failed(invoice)
        
    return {"status": "success"}


async def handle_checkout_completed(session):
    """
    Fulfill the subscription after successful payment
    """
    db = SessionLocal()
    try:
        metadata = session.get("metadata", {}) or {}
        user_id = metadata.get("user_id")
        plan_id = metadata.get("plan_id")
        billing_period = metadata.get("billing_period")

        if not user_id or not plan_id:
            stripe_subscription_id = session.get("subscription")
            if stripe_subscription_id:
                try:
                    stripe_sub = stripe.Subscription.retrieve(stripe_subscription_id)
                    sub_meta = stripe_sub.get("metadata", {}) or {}
                    user_id = user_id or sub_meta.get("user_id")
                    plan_id = plan_id or sub_meta.get("plan_id")
                    billing_period = billing_period or sub_meta.get("billing_period")
                except Exception as e:
                    logger.error(f"Failed to fetch Stripe subscription metadata: {e}")

        if not user_id or not plan_id:
            logger.error("Missing metadata in Stripe session")
            return
            
        user = db.query(UserAccount).filter(UserAccount.id == int(user_id)).first()
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == int(plan_id)).first()
        
        if not user or not plan:
            logger.error("User or Plan not found")
            return
            
        # Create Subscription Record
        # Check if subscription already exists for this session
        existing = db.query(Subscription).filter(
            Subscription.stripe_checkout_session_id == session["id"]
        ).first()
        
        if existing:
            logger.info(f"Subscription for session {session['id']} already processed")
            return

        # Calculate dates
        started_at = datetime.utcnow()
        if billing_period == "monthly":
            ends_at = started_at + timedelta(days=30)
        else:
            ends_at = started_at + timedelta(days=365)
            
        amount_paid = session.get("amount_total")
        if amount_paid is not None:
            amount_paid = amount_paid / 100.0
        new_subscription = Subscription(
            user_id=user.id,
            plan_id=plan.id,
            status="active",
            amount_paid=amount_paid,
            billing_period=billing_period,
            started_at=started_at,
            ends_at=ends_at,
            payment_method="stripe",
            transaction_id=session.get("payment_intent") or session.get("subscription"),
            stripe_checkout_session_id=session["id"],
            stripe_subscription_id=session.get("subscription")
        )
        db.add(new_subscription)
        
        # Update User Status
        user.current_plan_id = plan.id
        user.subscription_status = "active"
        user.subscription_started_at = started_at
        user.subscription_ends_at = ends_at
        user.stripe_customer_id = session["customer"]
        
        # Activate Integrations
        from app.api.subscription import _activate_integrations
        from app.utils.subscription import sync_tool_subscriptions
        await _activate_integrations(user, plan, db)
        sync_tool_subscriptions(db, user)
        
        db.commit()
        logger.info(f"Subscription activated for user {user.id}")
        
    except Exception as e:
        logger.error(f"Error handling checkout completion: {str(e)}")
        db.rollback()
    finally:
        db.close()

async def handle_invoice_payment_succeeded(invoice: dict):
    db = SessionLocal()
    try:
        subscription_id = invoice.get("subscription")
        if not subscription_id:
            return
        subscription = db.query(Subscription).filter(Subscription.stripe_subscription_id == subscription_id).first()
        if not subscription:
            return
        now = datetime.utcnow()
        if subscription.billing_period == "yearly":
            subscription.ends_at = now + timedelta(days=365)
        else:
            subscription.ends_at = now + timedelta(days=30)
        subscription.status = "active"
        db.commit()
    except Exception as e:
        logger.error(f"Error handling invoice payment: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()

async def handle_invoice_payment_failed(invoice: dict):
    db = SessionLocal()
    try:
        subscription_id = invoice.get("subscription")
        if not subscription_id:
            return
        subscription = db.query(Subscription).filter(Subscription.stripe_subscription_id == subscription_id).first()
        if not subscription:
            return
        subscription.status = "past_due"
        db.commit()
    except Exception as e:
        logger.error(f"Error handling invoice failure: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()
