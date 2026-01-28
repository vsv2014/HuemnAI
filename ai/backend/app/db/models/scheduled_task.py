from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
import enum

class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class ScheduledTask(Base):
    """Tasks scheduled for future execution"""
    __tablename__ = "scheduled_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    
    # Task details
    task_type = Column(String(50), nullable=False)
    name = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    
    # Scheduling
    scheduled_time = Column(DateTime(timezone=True), nullable=False, index=True)
    recurrence = Column(String(50), nullable=True)  # Cron expression or similar
    
    # Execution
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.PENDING, index=True)
    payload = Column(JSON, nullable=True)  # Data required for execution
    result = Column(JSON, nullable=True)  # Execution result
    error = Column(Text, nullable=True)
    
    # Metadata
    created_by = Column(Integer, nullable=True)  # User ID
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    executed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    agent = relationship("Agent")
