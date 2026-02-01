from sqlalchemy.orm import Session
from fastapi import Request
from typing import Optional, Dict, Any
from app.db.models.audit import AuditLog
from app.db.models.subscription import UserAccount
from app.core.pii import redact_pii
import logging

logger = logging.getLogger(__name__)

def log_audit_event(
    db: Session,
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    user: Optional[UserAccount] = None,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None
):
    """
    Log an audit event to the database.
    Automatically redacts PII from 'details'.
    """
    try:
        # Redact PII from details
        safe_details = redact_pii(details) if details else None
        
        ip_address = None
        if request:
            ip_address = request.client.host
        
        audit_entry = AuditLog(
            user_id=user.id if user else None,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=safe_details,
            ip_address=ip_address
        )
        
        db.add(audit_entry)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to write audit log: {e}")
        # Don't raise exception to prevent blocking main flow
