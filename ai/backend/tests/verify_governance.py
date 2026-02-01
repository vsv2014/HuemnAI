import sys
import os
from datetime import datetime

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.db.models.subscription import UserAccount
from app.db.models.audit import AuditLog
from app.core.pii import redact_pii
from app.services.audit_service import log_audit_event

def verify_governance():
    print("Verifying Governance Features...")
    
    # 1. PII Redaction
    print("\n[1] Testing PII Redaction...")
    sensitive_data = {
        "user": {
            "email": "john.doe@example.com",
            "phone": "123-456-7890",
            "cc": "1234-5678-9012-3456",
            "id": 123
        },
        "message": "Call me at 555-0199 please."
    }
    redacted = redact_pii(sensitive_data)
    print(f"Original: {sensitive_data['user']['email']}")
    print(f"Redacted: {redacted['user']['email']}")
    
    assert redacted['user']['email'] == "[EMAIL_REDACTED]"
    assert redacted['user']['phone'] == "[PHONE_REDACTED]"
    assert redacted['user']['cc'] == "[CC_REDACTED]"
    assert redacted['user']['id'] == 123  # Should not be redacted
    print("✅ PII Redaction Passed")

    # 2. Database Schema (RBAC & Audit)
    print("\n[2] Testing Database Schema...")
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Create Admin User
        admin_email = f"admin_test_{int(datetime.now().timestamp())}@example.com"
        admin = UserAccount(
            email=admin_email,
            name="Admin User",
            role="admin",
            is_active=True
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        print(f"Created User: {admin.email} with Role: {admin.role}")
        assert admin.role == "admin"
        
        # 3. Audit Logging
        print("\n[3] Testing Audit Logging...")
        log_audit_event(
            db=db,
            action="create_agent",
            resource_type="agent",
            resource_id="agent_123",
            user=admin,
            details={"name": "Secret Agent", "owner_email": "ceo@example.com"}
        )
        
        # Verify Log
        log = db.query(AuditLog).filter(AuditLog.user_id == admin.id).first()
        print(f"Audit Log Found: {log.action} - {log.details}")
        
        assert log.action == "create_agent"
        assert log.details["owner_email"] == "[EMAIL_REDACTED]"
        print("✅ Audit Logging (with Redaction) Passed")
        
    finally:
        db.close()

if __name__ == "__main__":
    verify_governance()
