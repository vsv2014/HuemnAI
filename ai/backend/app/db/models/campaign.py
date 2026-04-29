from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
import enum

class CampaignType(str, enum.Enum):
    VOICE = "voice"
    SMS = "sms"
    WHATSAPP = "whatsapp"
    PROACTIVE_WEB = "proactive_web"

class CampaignStatus(str, enum.Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class Campaign(Base):
    """Voice/SMS Outreach Campaign"""
    __tablename__ = "campaigns"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    campaign_type = Column(SQLEnum(CampaignType), default=CampaignType.VOICE)
    status = Column(SQLEnum(CampaignStatus), default=CampaignStatus.DRAFT)
    
    # Configuration
    template_id = Column(Integer, nullable=True) # Reference to a message/ivr template
    schedule_time = Column(DateTime(timezone=True), nullable=True)
    recurrence = Column(String(100), nullable=True) # Cron
    
    # Settings
    concurrency_limit = Column(Integer, default=1)
    retry_config = Column(JSON, nullable=True) # {max_retries: 3, retry_delay: 3600}
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    leads = relationship("CampaignLead", back_populates="campaign", cascade="all, delete-orphan")
    agent = relationship("Agent")

class LeadStatus(str, enum.Enum):
    PENDING = "pending"
    QUEUED = "queued"
    CONTACTED = "contacted"
    FAILED = "failed"
    OPTED_OUT = "opted_out"
    BUSY = "busy"
    NO_ANSWER = "no_answer"

class CampaignLead(Base):
    """Targets for outreach campaigns"""
    __tablename__ = "campaign_leads"
    
    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False, index=True)
    
    # Identity
    phone_number = Column(String(20), nullable=False, index=True)
    email = Column(String(255), nullable=True)
    name = Column(String(255), nullable=True)
    
    # Execution Status
    status = Column(SQLEnum(LeadStatus), default=LeadStatus.PENDING)
    last_attempt_at = Column(DateTime(timezone=True), nullable=True)
    attempts_count = Column(Integer, default=0)
    last_result = Column(Text, nullable=True)
    
    # Context
    custom_data = Column(JSON, nullable=True) # Variables for template merge
    
    campaign = relationship("Campaign", back_populates="leads")

class DncList(Base):
    """Do Not Call / Opt-out Registry"""
    __tablename__ = "dnc_list"
    
    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String(20), nullable=False, unique=True, index=True)
    reason = Column(String(255), nullable=True)
    opt_out_timestamp = Column(DateTime(timezone=True), server_default=func.now())
    user_id = Column(Integer, nullable=True) # Who requested DNC if available
