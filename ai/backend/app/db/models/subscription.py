from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, JSON, Text, Index
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
from app.db.base import Base
from app.core.security import encrypt_string, decrypt_string
import json

class SubscriptionPlan(Base):
    """Subscription plan definitions"""
    __tablename__ = "subscription_plans"
    
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True)  # "basic", "professional", "enterprise"
    display_name = Column(String)  # "Basic Plan", "Professional Plan"
    price_monthly = Column(Float)  # Original price
    price_yearly = Column(Float)  # Original yearly price
    features = Column(JSON)  # List of features included
    integrations = Column(JSON)  # List of integrations included (e.g., ["zendesk", "jira"])
    max_users = Column(Integer, default=1)  # Max users for this plan
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class UserAccount(Base):
    """Extended user account with authentication and subscription"""
    __tablename__ = "user_accounts"
    
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)  # Hashed password
    name = Column(String)
    ip_address = Column(String)  # For trial restriction
    role = Column(String, default="viewer")  # "admin", "editor", "viewer"
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    
    # Organization/Company fields (for Enterprise plans)
    organization_name = Column(String, nullable=True)  # Company/Organization name
    organization_size = Column(String, nullable=True)  # "small", "medium", "large", "enterprise"
    is_company_account = Column(Boolean, default=False)  # True for enterprise/company accounts
    
    # Subscription fields
    current_plan_id = Column(Integer, ForeignKey("subscription_plans.id"), nullable=True)
    stripe_customer_id = Column(String, nullable=True, index=True)  # Stripe Customer ID
    subscription_status = Column(String, default="trial")  # "trial", "active", "expired", "cancelled"
    trial_started_at = Column(DateTime, nullable=True)
    trial_ends_at = Column(DateTime, nullable=True)
    subscription_started_at = Column(DateTime, nullable=True)
    subscription_ends_at = Column(DateTime, nullable=True)
    has_used_trial = Column(Boolean, default=False)  # Track if user has used trial from this IP
    
    # Relationships
    subscription_plan = relationship("SubscriptionPlan", foreign_keys=[current_plan_id])
    subscriptions = relationship("Subscription", back_populates="user")
    integrations = relationship("UserIntegration", back_populates="user")
    tool_subscriptions = relationship("UserToolSubscription", back_populates="user")

class Subscription(Base):
    """Subscription history and payments"""
    __tablename__ = "subscriptions"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user_accounts.id"))
    plan_id = Column(Integer, ForeignKey("subscription_plans.id"))
    status = Column(String)  # "active", "cancelled", "expired", "pending"
    amount_paid = Column(Float)
    discount_applied = Column(Float, default=0.0)  # Discount percentage
    billing_period = Column(String)  # "monthly", "yearly"
    started_at = Column(DateTime, default=datetime.utcnow)
    ends_at = Column(DateTime)
    cancelled_at = Column(DateTime, nullable=True)
    payment_method = Column(String, nullable=True)
    transaction_id = Column(String, nullable=True)
    stripe_subscription_id = Column(String, nullable=True, index=True)
    stripe_checkout_session_id = Column(String, nullable=True)
    
    # Relationships
    user = relationship("UserAccount", back_populates="subscriptions")
    plan = relationship("SubscriptionPlan")

class UserIntegration(Base):
    """User's active integrations (Zendesk, Jira, etc.)"""
    __tablename__ = "user_integrations"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user_accounts.id"))
    integration_type = Column(String)  # "zendesk", "jira", "salesforce", etc.
    integration_name = Column(String)  # Display name
    is_active = Column(Boolean, default=True)
    credentials = Column(JSON)  # Encrypted credentials
    configured_at = Column(DateTime, default=datetime.utcnow)
    last_sync = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("UserAccount", back_populates="integrations")

    def set_credentials(self, creds: dict):
        """Encrypt and set credentials"""
        if creds:
            creds_str = json.dumps(creds)
            self.credentials = {"encrypted_data": encrypt_string(creds_str)}
        else:
            self.credentials = None

    def get_credentials(self) -> dict:
        """Decrypt and return credentials"""
        if self.credentials and "encrypted_data" in self.credentials:
            decrypted_str = decrypt_string(self.credentials["encrypted_data"])
            try:
                return json.loads(decrypted_str)
            except json.JSONDecodeError:
                return {}
        return self.credentials or {}


class UserToolSubscription(Base):
    """Track which tools a user has subscribed to"""
    __tablename__ = "user_tool_subscriptions"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user_accounts.id"))
    tool_name = Column(String)  # "agent-builder", "customer-service", etc.
    tool_display_name = Column(String)
    subscription_status = Column(String, default="active")
    is_active = Column(Boolean, default=True)
    subscribed_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    
    # Usage tracking
    tokens_used = Column(Integer, default=0)
    tokens_remaining = Column(Integer, default=0)
    tokens_total = Column(Integer, default=0)
    
    user = relationship("UserAccount", back_populates="tool_subscriptions")
    sessions = relationship("UserToolSession", back_populates="tool_subscription")
    __table_args__ = (
        Index("ix_user_tool_subscriptions_user_tool_active", "user_id", "tool_name", "is_active"),
    )

class UserToolSession(Base):
    """Track active sessions for a tool"""
    __tablename__ = "user_tool_sessions"
    
    id = Column(Integer, primary_key=True)
    tool_subscription_id = Column(Integer, ForeignKey("user_tool_subscriptions.id"))
    session_id = Column(String, unique=True, index=True)
    user_id = Column(Integer, index=True)
    tool_name = Column(String, index=True)
    session_started_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, default=datetime.utcnow)
    last_activity_at = Column(DateTime, default=datetime.utcnow)
    last_consumption_at = Column(DateTime, default=datetime.utcnow)
    tokens_consumed = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    
    tool_subscription = relationship("UserToolSubscription", back_populates="sessions")
    __table_args__ = (
        Index("ix_user_tool_sessions_user_tool", "user_id", "tool_name"),
    )

class EmailVerification(Base):
    """Store OTPs for email verification"""
    __tablename__ = "email_verifications"
    
    email = Column(String, primary_key=True, index=True)
    otp_code = Column(String)
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
