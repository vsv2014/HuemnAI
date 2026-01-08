from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.sql import func
from app.db.base import Base

class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, nullable=True)

    status = Column(String, default="open")
    priority = Column(String, default="medium")
    assigned_to = Column(String, nullable=True)
    
    # Enhanced fields for troubleshooting and information collection
    title = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    customer_info = Column(JSON, nullable=True)  # Store collected customer information
    troubleshooting_steps = Column(JSON, nullable=True)  # Store troubleshooting steps taken
    conversation_history = Column(JSON, nullable=True)  # Store conversation between agent and customer
    external_ticket_id = Column(String, nullable=True)  # ID from external system (Jira, Zendesk, etc.)
    connector_type = Column(String, nullable=True)  # jira, zendesk, salesforce, etc.
    severity = Column(String, nullable=True)  # critical, high, medium, low
    customer_channel = Column(String, nullable=True)  # email, chat, phone, etc.
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
