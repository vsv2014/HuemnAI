from app.db.session import SessionLocal
from app.db.models.ticket import Ticket
from app.services.agent_router import select_best_agent
from typing import Dict, List, Optional
from datetime import datetime
import logging

# Import connector manager
from app.core.connector_manager import get_connector

logger = logging.getLogger(__name__)

# Common troubleshooting questions
TROUBLESHOOTING_QUESTIONS = [
    "What error message are you seeing?",
    "When did this issue start?",
    "What steps have you already tried?",
    "What device/browser are you using?",
    "Can you provide your account email or user ID?",
]

# Ticket templates based on issue type
TICKET_TEMPLATES = {
    "login": {
        "title_template": "Login Issue: {description}",
        "questions": [
            "What specific error message do you see when trying to log in?",
            "Are you able to access the password reset page?",
            "When did you last successfully log in?",
            "Have you tried resetting your password?",
        ],
        "default_priority": "high"
    },
    "agent_builder": {
        "title_template": "Agent Builder Issue: {description}",
        "questions": [
            "What specifically is not working in the Agent Builder?",
            "Can you provide screenshots or a screen recording of the error?",
            "Are you seeing any error messages in the console? (If possible, please provide a HAR file)",
            "What browser and version are you using?",
        ],
        "default_priority": "medium"
    },
    "payment": {
        "title_template": "Payment/Billing Issue: {description}",
        "questions": [
            "What type of payment issue are you experiencing?",
            "What is the transaction ID or reference number?",
            "When did this payment issue occur?",
            "What payment method are you using?",
        ],
        "default_priority": "high"
    },
    "technical": {
        "title_template": "Technical Issue: {description}",
        "questions": [
            "What error message or issue are you experiencing?",
            "When did this issue first occur?",
            "What steps can we take to reproduce this issue?",
            "What device, browser, or application are you using?",
            "Have you tried any troubleshooting steps already?",
        ],
        "default_priority": "medium"
    },
    "account": {
        "title_template": "Account Issue: {description}",
        "questions": [
            "What account-related problem are you facing?",
            "What is your account email or username?",
            "When did you first notice this issue?",
            "Have you made any recent changes to your account?",
        ],
        "default_priority": "medium"
    },
    "general": {
        "title_template": "Support Request: {description}",
        "questions": [
            "Can you describe your issue in more detail?",
            "When did this issue start?",
            "What impact is this having on your work?",
            "Is there anything else we should know?",
        ],
        "default_priority": "low"
    }
}

# Severity-based priority mapping
SEVERITY_PRIORITY_MAP = {
    "critical": "urgent",  # System down, data loss, security breach
    "high": "high",        # Major feature broken, significant impact
    "medium": "medium",    # Minor feature issue, moderate impact
    "low": "low"          # Cosmetic issue, low impact
}

def detect_issue_type(message: str) -> str:
    """
    Detect the type of issue from the message to select appropriate template.
    Returns: 'login', 'payment', 'technical', 'account', or 'general'
    """
    message_lower = message.lower()
    
    # Login issues
    if any(word in message_lower for word in ["login", "password", "authenticate", "sign in", "access denied", "locked out"]):
        return "login"
    
    # Payment issues
    if any(word in message_lower for word in ["payment", "billing", "charge", "invoice", "refund", "transaction", "subscription"]):
        return "payment"
    
    # Account issues
    if any(word in message_lower for word in ["account", "profile", "settings", "user", "registration"]):
        return "account"
    
    # Technical issues
    if any(word in message_lower for word in ["error", "bug", "broken", "not working", "crash", "freeze", "slow", "timeout"]):
        return "technical"
    
    return "general"


def determine_severity(message: str, conversation_history: List[Dict] = None) -> str:
    """
    Determine severity level based on message content and context.
    Returns: 'critical', 'high', 'medium', or 'low'
    """
    message_lower = message.lower()
    full_context = message_lower
    
    if conversation_history:
        full_context += " " + " ".join([msg.get("text", "").lower() for msg in conversation_history])
    
    # Critical indicators
    critical_keywords = ["down", "outage", "security breach", "data loss", "hacked", "compromised", 
                        "cannot access", "system unavailable", "complete failure", "emergency"]
    if any(keyword in full_context for keyword in critical_keywords):
        return "critical"
    
    # High severity indicators
    high_keywords = ["urgent", "critical", "important", "blocking", "cannot work", "major", 
                    "significant impact", "affecting multiple", "production down"]
    if any(keyword in full_context for keyword in high_keywords):
        return "high"
    
    # Low severity indicators
    low_keywords = ["minor", "cosmetic", "small", "nice to have", "enhancement", "suggestion"]
    if any(keyword in full_context for keyword in low_keywords):
        return "low"
    
    # Default to medium
    return "medium"


def get_ticket_template(issue_type: str) -> Dict:
    """Get ticket template for a specific issue type"""
    return TICKET_TEMPLATES.get(issue_type, TICKET_TEMPLATES["general"])


def get_next_question(issue_type: str, collected_info: Dict, conversation_history: List[Dict] = None) -> Optional[str]:
    """
    Determine the next question to ask based on issue type and collected information.
    Returns the next question or None if enough information is collected.
    """
    template = get_ticket_template(issue_type)
    questions = template.get("questions", [])
    
    if not questions:
        return None
    
    # Track which questions have been asked/answered
    # Use collected_info to track progress
    answered_count = collected_info.get("_answered_questions_count", 0)
    
    # If we've answered all questions, return None
    if answered_count >= len(questions):
        return None
    
    # Return the next unanswered question
    return questions[answered_count] if answered_count < len(questions) else None


def collect_troubleshooting_info(conversation: List[Dict]) -> Dict:
    """
    Extract troubleshooting information from conversation history.
    Returns a dict with collected information.
    """
    info = {
        "error_message": None,
        "start_time": None,
        "steps_tried": [],
        "device_info": None,
        "user_identifier": None,
        "description": ""
    }
    
    # Simple extraction from conversation
    full_text = " ".join([msg.get("text", "") for msg in conversation if msg.get("role") == "user"])
    
    # Extract common patterns
    if "error" in full_text.lower():
        # Try to extract error message
        parts = full_text.lower().split("error")
        if len(parts) > 1:
            info["error_message"] = parts[1].strip()[:200]
    
    # Extract email
    import re
    email_match = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', full_text)
    if email_match:
        info["user_identifier"] = email_match.group()
    
    info["description"] = full_text[:500]  # First 500 chars as description
    
    return info

def perform_basic_troubleshooting(issue_description: str) -> Dict:
    """
    Perform basic troubleshooting based on issue description.
    Returns troubleshooting steps and potential solutions.
    """
    issue_lower = issue_description.lower()
    steps = []
    potential_solution = None
    
    # Common issues and solutions
    if any(word in issue_lower for word in ["login", "password", "authenticate"]):
        steps.append("Check if password meets requirements")
        steps.append("Try password reset")
        steps.append("Verify account is not locked")
        potential_solution = "Password reset may be required. Check email for reset link."
    
    elif any(word in issue_lower for word in ["payment", "billing", "charge"]):
        steps.append("Verify payment method is valid")
        steps.append("Check bank account balance")
        steps.append("Review transaction history")
        potential_solution = "Payment issues usually require checking payment method validity and account balance."
    
    elif any(word in issue_lower for word in ["email", "not received", "not getting"]):
        steps.append("Check spam/junk folder")
        steps.append("Verify email address is correct")
        steps.append("Check email server status")
        potential_solution = "Check spam folder and verify email address. Email delivery can be delayed."
    
    elif any(word in issue_lower for word in ["slow", "loading", "timeout"]):
        steps.append("Check internet connection")
        steps.append("Clear browser cache")
        steps.append("Try different browser")
        potential_solution = "Performance issues often relate to network or browser cache. Try clearing cache."
    
    else:
        steps.append("Gather detailed error information")
        steps.append("Check system logs if applicable")
        steps.append("Verify recent changes to account")
        potential_solution = "More information needed. Please provide error messages and steps to reproduce."
    
    return {
        "steps": steps,
        "potential_solution": potential_solution,
        "requires_agent": len(steps) >= 3  # If multiple steps, likely needs agent
    }

def create_ticket_with_template(
    initial_message: str,
    conversation_history: List[Dict] = None,
    connector_type: Optional[str] = None,
    collected_info: Optional[Dict] = None,
    question_index: int = 0,
    attachments: Optional[List[str]] = None,
    operation_mode: str = "integrated"
) -> Dict:
    """
    Create a ticket using template-based approach with question flow.
    Returns dict with ticket info and next question if needed.
    """
    # Detect issue type
    issue_type = detect_issue_type(initial_message)
    template = get_ticket_template(issue_type)
    
    # Determine severity and priority
    severity = determine_severity(initial_message, conversation_history)
    priority = SEVERITY_PRIORITY_MAP.get(severity, "medium")
    
    # Override with template default if not explicitly set
    if priority == "medium" and template.get("default_priority"):
        priority = template["default_priority"]
    
    # Collect information
    if collected_info is None:
        collected_info = collect_troubleshooting_info((conversation_history or []) + [{"role": "user", "text": initial_message}])
    
    # Track question progress
    collected_info["_answered_questions_count"] = question_index
    collected_info["_issue_type"] = issue_type
    
    # Generate title from template
    title = template["title_template"].format(description=initial_message[:50])
    
    # Get next question
    questions = template.get("questions", [])
    next_question = None
    if question_index < len(questions):
        next_question = questions[question_index]
    
    # If we have enough info or no more questions, create the ticket
    if not next_question or question_index >= len(questions):
        ticket = create_ticket_with_info(
            title=title,
            description=initial_message,
            customer_info=collected_info,
            connector_type=connector_type,
            priority=priority,
            attachments=attachments,
            operation_mode=operation_mode
        )
        return {
            "ticket_created": True,
            "ticket_id": ticket.id,
            "ticket": ticket,
            "next_question": None,
            "issue_type": issue_type,
            "severity": severity,
            "priority": priority
        }
    else:
        # Return question flow state
        return {
            "ticket_created": False,
            "next_question": next_question,
            "issue_type": issue_type,
            "severity": severity,
            "priority": priority,
            "collected_info": collected_info,
            "template": template
        }


def create_ticket_with_info(
    title: str,
    description: str,
    customer_info: Optional[Dict] = None,
    connector_type: Optional[str] = None,
    priority: str = "medium",
    attachments: Optional[List[str]] = None,
    operation_mode: str = "integrated"
) -> Ticket:
    """
    Create a ticket with collected information and assign to best agent.
    Works in both independent and integrated modes.
    """
    db = SessionLocal()
    try:
        # Perform basic troubleshooting
        troubleshooting = perform_basic_troubleshooting(description)
        
        # Select best agent
        agent_id = select_best_agent(priority)
        
        # In independent mode, don't use external connector
        if operation_mode == "independent":
            connector_type = None
        
        # Detect customer communication channel
        from app.services.communication_bridge import detect_customer_channel
        customer_channel = detect_customer_channel(customer_info or {}, description)
        
        # Create ticket in database
        ticket = Ticket(
            title=title,
            description=description,
            customer_info=customer_info or {},
            troubleshooting_steps=troubleshooting.get("steps", []),
            priority=priority,
            assigned_to=agent_id,
            status="open",
            connector_type=connector_type,
            customer_channel=customer_channel,
            attachments=attachments or []
        )
        
        # Initialize conversation history with customer's initial message
        ticket.conversation_history = [{
            "role": "user",
            "text": description,
            "timestamp": datetime.utcnow().isoformat(),
            "customer_info": customer_info or {}
        }]
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        
        # If connector is configured and in integrated mode, create ticket in external system
        if connector_type and operation_mode == "integrated":
            try:
                connector = get_connector(connector_type)
                if connector and hasattr(connector, 'create_ticket'):
                    external_ticket = connector.create_ticket(title, description)
                    if external_ticket and external_ticket.get("id"):
                        ticket.external_ticket_id = external_ticket["id"]
                        db.commit()
                        db.refresh(ticket)
            except Exception as e:
                logger.warning(f"Failed to create ticket in {connector_type}: {e}")
        
        return ticket
    finally:
        db.close()

def create_ticket(conversation_id: int | None, assigned_to: str, priority: str = "medium"):
    """
    Legacy function for backward compatibility.
    """
    db = SessionLocal()
    try:
        ticket = Ticket(
            conversation_id=conversation_id,
            assigned_to=assigned_to,
            priority=priority,
            status="open"
        )
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        return ticket
    finally:
        db.close()

def get_ticket(ticket_id: int) -> Optional[Ticket]:
    """Get ticket by ID"""
    db = SessionLocal()
    try:
        return db.query(Ticket).filter(Ticket.id == ticket_id).first()
    finally:
        db.close()

def update_ticket_status(ticket_id: int, status: str) -> Optional[Ticket]:
    """Update ticket status"""
    db = SessionLocal()
    try:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if ticket:
            ticket.status = status
            if status == "resolved":
                from datetime import datetime
                ticket.resolved_at = datetime.utcnow()
            db.commit()
            db.refresh(ticket)
        return ticket
    finally:
        db.close()

def update_ticket_description(ticket_id: int, new_message: str) -> Optional[Ticket]:
    """Append new message to ticket description"""
    db = SessionLocal()
    try:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if ticket:
            current_desc = ticket.description or ""
            ticket.description = f"{current_desc}\n\n[Update] {new_message}" if current_desc else new_message
            db.commit()
            db.refresh(ticket)
        return ticket
    finally:
        db.close()

def get_or_create_ticket_for_user(user_id: str, message: str, **kwargs) -> Ticket:
    """Get existing open ticket for user or create a new one"""
    db = SessionLocal()
    try:
        # Find existing open ticket
        existing = db.query(Ticket).filter(
            Ticket.assigned_to == user_id,
            Ticket.status == "open"
        ).order_by(Ticket.created_at.desc()).first()
        
        if existing:
            return existing
        
        # Create new ticket if none exists
        return create_ticket_with_info(
            title=f"Support Request: {message[:50]}",
            description=message,
            **kwargs
        )
    finally:
        db.close()
