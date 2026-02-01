from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class AuditLog(Base):
    """
    Audit Log for tracking sensitive actions in the system.
    Follows SOC2 compliance requirements.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user_accounts.id"), nullable=True)  # Nullable for system actions
    action = Column(String, nullable=False)  # e.g., "create_agent", "delete_node"
    resource_type = Column(String, nullable=False)  # e.g., "agent", "node", "user"
    resource_id = Column(String, nullable=True)  # ID of the resource affected
    details = Column(JSON, nullable=True)  # Changed fields, diffs, etc.
    ip_address = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("app.db.models.subscription.UserAccount")
