from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
from app.db.base import Base

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


class UserToolSubscription(Base):
    """Track which tools a user has subscribed to"""
    __tablename__ = "user_tool_subscriptions"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user_accounts.id"), nullable=False)
    tool_name = Column(String, nullable=False)  # "customer_service", "ticket_solver", etc.
    tool_display_name = Column(String)  # "Customer Service", "Ticket Solver", etc.
    subscription_status = Column(String, default="active")  # "active", "expired", "cancelled"
    subscribed_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)  # None for lifetime subscriptions
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Per-tool token system
    tokens_remaining = Column(Integer, default=50000)  # 50,000 tokens per tool
    tokens_total = Column(Integer, default=50000)  # Total tokens allocated for this tool
    
    # Relationships
    user = relationship("UserAccount", back_populates="tool_subscriptions")

class UserToolSession(Base):
    """Track user sessions per tool for token consumption"""
    __tablename__ = "user_tool_sessions"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user_accounts.id"), nullable=False)
    tool_name = Column(String, nullable=False)
    session_started_at = Column(DateTime, default=datetime.utcnow)
    last_activity_at = Column(DateTime, default=datetime.utcnow)
    tokens_consumed = Column(Integer, default=0)  # Tokens consumed in this session
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("UserAccount")
