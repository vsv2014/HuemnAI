from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class CRMAccount(Base):
    __tablename__ = "crm_accounts"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user_accounts.id"), index=True)
    name = Column(String, index=True)
    domain = Column(String, index=True)
    industry = Column(String)
    size = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    owner = relationship("UserAccount")

class CRMContact(Base):
    __tablename__ = "crm_contacts"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user_accounts.id"), index=True)
    account_id = Column(Integer, ForeignKey("crm_accounts.id"), nullable=True)
    name = Column(String, index=True)
    email = Column(String, index=True)
    phone = Column(String)
    company = Column(String, index=True)
    status = Column(String, index=True)
    last_interaction = Column(String)
    score = Column(Integer, default=0)
    channels = Column(JSON, default=[])
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    owner = relationship("UserAccount")
    account = relationship("CRMAccount")

class CRMDeal(Base):
    __tablename__ = "crm_deals"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user_accounts.id"), index=True)
    account_id = Column(Integer, ForeignKey("crm_accounts.id"), nullable=True)
    title = Column(String, index=True)
    company = Column(String, index=True)
    stage = Column(String, index=True)
    value = Column(Integer, default=0)
    probability = Column(Integer, default=0)
    owner_name = Column(String)
    due_date = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    owner = relationship("UserAccount")
    account = relationship("CRMAccount")

class CRMActivity(Base):
    __tablename__ = "crm_activities"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user_accounts.id"), index=True)
    contact_id = Column(Integer, ForeignKey("crm_contacts.id"), nullable=True)
    account_id = Column(Integer, ForeignKey("crm_accounts.id"), nullable=True)
    type = Column(String, index=True)
    title = Column(String)
    description = Column(Text)
    channel = Column(String)
    sentiment = Column(String)
    timestamp = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    owner = relationship("UserAccount")
    contact = relationship("CRMContact")
    account = relationship("CRMAccount")
