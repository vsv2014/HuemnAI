from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models.subscription import (
    UserAccount, SubscriptionPlan, Subscription, UserIntegration, UserToolSubscription, UserToolSession
)
from app.api.auth import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class SubscribeRequest(BaseModel):
    plan_id: int
    billing_period: str  # "monthly" or "yearly"
    payment_method: Optional[str] = None
    organization_name: Optional[str] = None  # For enterprise/company accounts
    organization_size: Optional[str] = None  # "small", "medium", "large", "enterprise"

class SubscriptionResponse(BaseModel):
    success: bool
    message: str
    subscription: Optional[dict] = None

# Pricing configuration (with 50% discount for first subscription)
# Custom pricing as specified
PRICING = {
    "basic": {
        "monthly": 199.0,  # Basic plan: $199/month, First subscription: $99.50
        "yearly": 1990.0,  # Basic yearly: $1,990/year, First subscription: $995 (save 2 months)
        "features": [
            "Access to 2 AI agents",
            "Basic integrations (Zendesk, Jira)",
            "Email support",
            "5,000 queries/month",
            "Basic analytics dashboard",
            "Knowledge base access",
            "Standard response templates",
            "Ticket management system",
            "Basic reporting & insights",
            "Mobile app access"
        ],
        "integrations": ["zendesk", "jira"]
    },
    "professional": {
        "monthly": 599.0,  # Advanced plan: $599/month (most popular)
        "yearly": 5990.0,  # Advanced yearly: $5,990/year
        "features": [
            "Access to 5 AI agents",
            "All integrations (Zendesk, Jira, Salesforce, LinkedIn)",
            "Priority support",
            "50,000 queries/month",
            "Advanced analytics",
            "Real-time analytics dashboard",
            "Custom AI model training",
            "Advanced knowledge base management",
            "Custom response templates",
            "Multi-channel support (Email, Chat, Social)",
            "Advanced reporting & insights",
            "API access for integrations",
            "Team collaboration tools",
            "Workflow automation",
            "Mobile app access",
            "SLA monitoring & alerts"
        ],
        "integrations": ["zendesk", "jira", "salesforce", "linkedin"],
        "is_popular": True  # Mark as most popular
    },
    "enterprise": {
        "monthly": None,  # Enterprise: Contact for quotation
        "yearly": None,  # Enterprise: Contact for quotation
        "features": [
            "Unlimited AI agents",
            "All integrations + custom integrations",
            "24/7 dedicated support",
            "Unlimited queries",
            "Advanced analytics & reporting",
            "Custom training & onboarding",
            "Multi-user team management",
            "Company/organization dashboard",
            "SSO (Single Sign-On) support",
            "Custom branding & white-labeling",
            "Dedicated account manager",
            "SLA guarantees",
            "Priority feature requests",
            "On-premise deployment option"
        ],
        "integrations": ["zendesk", "jira", "salesforce", "linkedin", "greenhouse"],
        "max_users": 999999  # Unlimited for enterprise
    }
}

@router.get("/plans")
async def get_subscription_plans(db: Session = Depends(get_db)):
    """Get all available subscription plans"""
    plans = db.query(SubscriptionPlan).filter(SubscriptionPlan.is_active == True).all()
    
    if not plans:
        # Initialize plans if they don't exist
        for plan_name, plan_data in PRICING.items():
            # For enterprise, use None (will show "Contact for quotation")
            monthly_price = plan_data["monthly"] if plan_data["monthly"] is not None else None
            yearly_price = plan_data["yearly"] if plan_data["yearly"] is not None else None
            
            display_name = "Enterprise Plan" if plan_name == "enterprise" else (
                "Advanced Plan" if plan_name == "professional" else plan_name.capitalize() + " Plan"
            )
            
            plan = SubscriptionPlan(
                name=plan_name,
                display_name=display_name,
                price_monthly=monthly_price,
                price_yearly=yearly_price,
                features=plan_data["features"],
                integrations=plan_data["integrations"],
                max_users=plan_data.get("max_users", 1 if plan_name == "basic" else 5)
            )
            db.add(plan)
        db.commit()
        plans = db.query(SubscriptionPlan).filter(SubscriptionPlan.is_active == True).all()
    else:
        # Update existing plans to match current pricing configuration
        for plan in plans:
            if plan.name in PRICING:
                plan_data = PRICING[plan.name]
                # Update enterprise plan to have None prices (for "Contact for quotation")
                if plan.name == "enterprise":
                    plan.price_monthly = None
                    plan.price_yearly = None
                else:
                    plan.price_monthly = plan_data["monthly"]
                    plan.price_yearly = plan_data["yearly"]
                
                # Update display name for professional -> Advanced
                if plan.name == "professional":
                    plan.display_name = "Advanced Plan"
                
                # Update features and integrations
                plan.features = plan_data["features"]
                plan.integrations = plan_data["integrations"]
        db.commit()
        plans = db.query(SubscriptionPlan).filter(SubscriptionPlan.is_active == True).all()
    
    return {
        "plans": [
            {
                "id": plan.id,
                "name": plan.name,
                "display_name": plan.display_name,
                "price_monthly": None if plan.name == "enterprise" else (plan.price_monthly if plan.price_monthly and plan.price_monthly > 0 else None),
                "price_yearly": None if plan.name == "enterprise" else (plan.price_yearly if plan.price_yearly and plan.price_yearly > 0 else None),
                "original_price_monthly": None if plan.name == "enterprise" else (plan.price_monthly * 2 if plan.price_monthly and plan.price_monthly > 0 else None),
                "original_price_yearly": None if plan.name == "enterprise" else (plan.price_yearly * 2 if plan.price_yearly and plan.price_yearly > 0 else None),
                "discount": 50 if plan.name != "enterprise" else 0,  # 50% discount for first subscription (not for enterprise)
                "features": plan.features,
                "integrations": plan.integrations,
                "is_popular": PRICING.get(plan.name, {}).get("is_popular", False),
                "is_enterprise": plan.name == "enterprise"
            }
            for plan in plans
        ]
    }

@router.post("/subscribe", response_model=SubscriptionResponse)
async def subscribe(
    request: SubscribeRequest,
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Subscribe to a plan (with 50% discount for first subscription)"""
    # Get plan
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == request.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Check if user already has an active subscription
    existing_subscription = db.query(Subscription).filter(
        Subscription.user_id == user.id,
        Subscription.status == "active"
    ).first()
    
    # Calculate price with 50% discount for first subscription
    is_first_subscription = not existing_subscription
    discount = 0.5 if is_first_subscription else 0.0
    
    if request.billing_period == "monthly":
        original_price = plan.price_monthly
        price = plan.price_monthly * (1 - discount)
        ends_at = datetime.utcnow() + timedelta(days=30)
    else:
        original_price = plan.price_yearly
        price = plan.price_yearly * (1 - discount)
        ends_at = datetime.utcnow() + timedelta(days=365)
    
    # Create subscription record
    subscription = Subscription(
        user_id=user.id,
        plan_id=plan.id,
        status="active",
        amount_paid=price,
        discount_applied=discount * 100,  # Store as percentage
        billing_period=request.billing_period,
        started_at=datetime.utcnow(),
        ends_at=ends_at,
        payment_method=request.payment_method or "credit_card"
    )
    
    # Update user account
    user.current_plan_id = plan.id
    user.subscription_status = "active"
    user.subscription_started_at = datetime.utcnow()
    user.subscription_ends_at = ends_at
    
    # Set company account flag for enterprise plan
    if plan.name == "enterprise":
        user.is_company_account = True
        if request.organization_name:
            user.organization_name = request.organization_name
        if request.organization_size:
            user.organization_size = request.organization_size
    
    # Cancel any existing subscriptions
    if existing_subscription:
        existing_subscription.status = "cancelled"
        existing_subscription.cancelled_at = datetime.utcnow()
    
    db.add(subscription)
    db.commit()
    db.refresh(subscription)
    
    # Activate integrations based on plan
    for integration_type in plan.integrations:
        # Check if integration already exists
        existing = db.query(UserIntegration).filter(
            UserIntegration.user_id == user.id,
            UserIntegration.integration_type == integration_type
        ).first()
        
        if not existing:
            integration_names = {
                "zendesk": "Zendesk",
                "jira": "Jira",
                "salesforce": "Salesforce",
                "linkedin": "LinkedIn",
                "greenhouse": "Greenhouse"
            }
            
            integration = UserIntegration(
                user_id=user.id,
                integration_type=integration_type,
                integration_name=integration_names.get(integration_type, integration_type.capitalize()),
                is_active=True
            )
            db.add(integration)
    
    db.commit()
    
    return SubscriptionResponse(
        success=True,
        message=f"Successfully subscribed to {plan.display_name}! {'50% discount applied for first subscription.' if is_first_subscription else ''}",
        subscription={
            "id": subscription.id,
            "plan": plan.display_name,
            "amount_paid": price,
            "original_price": original_price,
            "discount": discount * 100,
            "billing_period": request.billing_period,
            "ends_at": ends_at.isoformat()
        }
    )

@router.get("/status")
async def get_subscription_status(
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's current subscription status"""
    trial_days_remaining = None
    if user.subscription_status == "trial" and user.trial_ends_at:
        trial_days = (user.trial_ends_at - datetime.utcnow()).days
        trial_days_remaining = max(0, trial_days)
    
    active_subscription = db.query(Subscription).filter(
        Subscription.user_id == user.id,
        Subscription.status == "active"
    ).first()
    
    integrations = db.query(UserIntegration).filter(
        UserIntegration.user_id == user.id,
        UserIntegration.is_active == True
    ).all()
    
    return {
        "subscription_status": user.subscription_status,
        "trial_days_remaining": trial_days_remaining,
        "current_plan": {
            "id": user.subscription_plan.id if user.subscription_plan else None,
            "name": user.subscription_plan.name if user.subscription_plan else None,
            "display_name": user.subscription_plan.display_name if user.subscription_plan else None
        } if user.subscription_plan else None,
        "active_subscription": {
            "id": active_subscription.id,
            "amount_paid": active_subscription.amount_paid,
            "discount_applied": active_subscription.discount_applied,
            "billing_period": active_subscription.billing_period,
            "ends_at": active_subscription.ends_at.isoformat() if active_subscription.ends_at else None
        } if active_subscription else None,
        "integrations": [
            {
                "id": int.id,
                "type": int.integration_type,
                "name": int.integration_name,
                "is_active": int.is_active
            }
            for int in integrations
        ]
    }


@router.post("/subscribe-tool")
async def subscribe_to_tool(
    tool_name: str,
    tool_display_name: Optional[str] = None,
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Subscribe to a specific tool"""
    # Check if user already has active subscription for this tool
    existing = db.query(UserToolSubscription).filter(
        UserToolSubscription.user_id == user.id,
        UserToolSubscription.tool_name == tool_name,
        UserToolSubscription.is_active == True
    ).first()
    
    if existing:
        return {
            "success": True,
            "message": f"Already subscribed to {tool_display_name or tool_name}",
            "tool_subscription": {
                "tool_name": existing.tool_name,
                "tool_display_name": existing.tool_display_name,
                "status": existing.subscription_status
            }
        }
    
    # Create tool subscription with 50,000 tokens
    tool_subscription = UserToolSubscription(
        user_id=user.id,
        tool_name=tool_name,
        tool_display_name=tool_display_name or tool_name.replace("_", " ").title(),
        subscription_status="active",
        is_active=True,
        subscribed_at=datetime.utcnow(),
        tokens_remaining=50000,
        tokens_total=50000
    )
    
    db.add(tool_subscription)
    db.commit()
    db.refresh(tool_subscription)
    
    return {
        "success": True,
        "message": f"Successfully subscribed to {tool_display_name or tool_name}",
        "tool_subscription": {
            "tool_name": tool_subscription.tool_name,
            "tool_display_name": tool_subscription.tool_display_name,
            "status": tool_subscription.subscription_status,
            "subscribed_at": tool_subscription.subscribed_at.isoformat()
        }
    }


@router.get("/subscribed-tools")
async def get_subscribed_tools(
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all tools user has subscribed to with per-tool token counts"""
    # During trial, all tools are accessible with 50,000 tokens each
    if user.subscription_status == "trial":
        all_tools_data = [
            {"tool_name": "customer_service", "tool_display_name": "Customer Service & Agent Console"},
            {"tool_name": "knowledge_ai", "tool_display_name": "Knowledge AI"},
            {"tool_name": "hr_services", "tool_display_name": "HR Services"},
            {"tool_name": "status_updater", "tool_display_name": "Status Updater"},
            {"tool_name": "analytics_dashboard", "tool_display_name": "Analytics Dashboard"},
        ]
        
        # Get or create tool subscriptions with tokens
        tools_with_tokens = []
        for tool_data in all_tools_data:
            tool_sub = db.query(UserToolSubscription).filter(
                UserToolSubscription.user_id == user.id,
                UserToolSubscription.tool_name == tool_data["tool_name"]
            ).first()
            
            if not tool_sub:
                # Create tool subscription with 50,000 tokens
                tool_sub = UserToolSubscription(
                    user_id=user.id,
                    tool_name=tool_data["tool_name"],
                    tool_display_name=tool_data["tool_display_name"],
                    tokens_remaining=50000,
                    tokens_total=50000,
                    subscription_status="active",
                    is_active=True
                )
                db.add(tool_sub)
                db.commit()
                db.refresh(tool_sub)
            
            tools_with_tokens.append({
                "tool_name": tool_sub.tool_name,
                "tool_display_name": tool_sub.tool_display_name,
                "tokens_remaining": tool_sub.tokens_remaining or 50000,
                "tokens_total": tool_sub.tokens_total or 50000,
                "subscribed_at": tool_sub.subscribed_at.isoformat() if tool_sub.subscribed_at else None,
                "status": tool_sub.subscription_status
            })
        
        return {
            "success": True,
            "tools": tools_with_tokens,
            "is_trial": True
        }
    
    # For subscribed users, return only subscribed tools with tokens
    tool_subscriptions = db.query(UserToolSubscription).filter(
        UserToolSubscription.user_id == user.id,
        UserToolSubscription.is_active == True,
        UserToolSubscription.subscription_status == "active"
    ).all()
    
    return {
        "success": True,
        "tools": [
            {
                "tool_name": sub.tool_name,
                "tool_display_name": sub.tool_display_name,
                "tokens_remaining": sub.tokens_remaining or 50000,
                "tokens_total": sub.tokens_total or 50000,
                "subscribed_at": sub.subscribed_at.isoformat() if sub.subscribed_at else None,
                "status": sub.subscription_status
            }
            for sub in tool_subscriptions
        ],
        "is_trial": False
    }

@router.get("/token-status/{tool_name}")
async def get_token_status(
    tool_name: str,
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's token status for a specific tool"""
    tool_sub = db.query(UserToolSubscription).filter(
        UserToolSubscription.user_id == user.id,
        UserToolSubscription.tool_name == tool_name
    ).first()
    
    if not tool_sub:
        # Create tool subscription with 50,000 tokens if it doesn't exist
        tool_sub = UserToolSubscription(
            user_id=user.id,
            tool_name=tool_name,
            tool_display_name=tool_name.replace("_", " ").title(),
            tokens_remaining=50000,
            tokens_total=50000,
            subscription_status="active",
            is_active=True
        )
        db.add(tool_sub)
        db.commit()
        db.refresh(tool_sub)
    
    # Get active session for this tool
    active_session = db.query(UserToolSession).filter(
        UserToolSession.user_id == user.id,
        UserToolSession.tool_name == tool_name,
        UserToolSession.is_active == True
    ).first()
    
    return {
        "success": True,
        "tokens_remaining": tool_sub.tokens_remaining or 50000,
        "tokens_total": tool_sub.tokens_total or 50000,
        "subscription_status": user.subscription_status,
        "trial_days_remaining": max(0, (user.trial_ends_at - datetime.utcnow()).days) if user.subscription_status == "trial" and user.trial_ends_at else None,
        "has_active_session": active_session is not None,
        "session_tokens_consumed": active_session.tokens_consumed if active_session else 0
    }

@router.post("/start-session/{tool_name}")
async def start_tool_session(
    tool_name: str,
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Start or resume a tool session (15-minute timeout)"""
    # Get or create tool subscription
    tool_sub = db.query(UserToolSubscription).filter(
        UserToolSubscription.user_id == user.id,
        UserToolSubscription.tool_name == tool_name
    ).first()
    
    if not tool_sub:
        tool_sub = UserToolSubscription(
            user_id=user.id,
            tool_name=tool_name,
            tool_display_name=tool_name.replace("_", " ").title(),
            tokens_remaining=50000,
            tokens_total=50000,
            subscription_status="active",
            is_active=True
        )
        db.add(tool_sub)
        db.commit()
        db.refresh(tool_sub)
    
    # Check for existing active session
    active_session = db.query(UserToolSession).filter(
        UserToolSession.user_id == user.id,
        UserToolSession.tool_name == tool_name,
        UserToolSession.is_active == True
    ).first()
    
    now = datetime.utcnow()
    session_timeout = timedelta(minutes=15)
    
    if active_session:
        # Check if session expired (15 minutes)
        time_since_activity = now - active_session.last_activity_at
        if time_since_activity > session_timeout:
            # Session expired, start new session but don't interrupt
            active_session.is_active = False
            db.commit()
            
            # Create new session
            new_session = UserToolSession(
                user_id=user.id,
                tool_name=tool_name,
                session_started_at=now,
                last_activity_at=now,
                tokens_consumed=0,
                is_active=True
            )
            db.add(new_session)
            db.commit()
            
            return {
                "success": True,
                "session_id": new_session.id,
                "is_new_session": True,
                "tokens_remaining": tool_sub.tokens_remaining,
                "tokens_total": tool_sub.tokens_total,
                "message": "New session started (previous session timed out)"
            }
        else:
            # Update last activity
            active_session.last_activity_at = now
            db.commit()
            
            return {
                "success": True,
                "session_id": active_session.id,
                "is_new_session": False,
                "tokens_remaining": tool_sub.tokens_remaining,
                "tokens_total": tool_sub.tokens_total,
                "session_tokens_consumed": active_session.tokens_consumed
            }
    else:
        # No active session, create new one
        new_session = UserToolSession(
            user_id=user.id,
            tool_name=tool_name,
            session_started_at=now,
            last_activity_at=now,
            tokens_consumed=0,
            is_active=True
        )
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        
        return {
            "success": True,
            "session_id": new_session.id,
            "is_new_session": True,
            "tokens_remaining": tool_sub.tokens_remaining,
            "tokens_total": tool_sub.tokens_total
        }

@router.post("/consume-token/{tool_name}")
async def consume_token(
    tool_name: str,
    tokens: int = 1,
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Consume tokens for tool usage in current session"""
    # Get tool subscription
    tool_sub = db.query(UserToolSubscription).filter(
        UserToolSubscription.user_id == user.id,
        UserToolSubscription.tool_name == tool_name
    ).first()
    
    if not tool_sub:
        return {
            "success": False,
            "message": "Tool subscription not found"
        }
    
    # Initialize tokens if not set
    if tool_sub.tokens_remaining is None:
        tool_sub.tokens_remaining = 50000
        tool_sub.tokens_total = 50000
    
    # Check if user has tokens
    if tool_sub.tokens_remaining < tokens:
        return {
            "success": False,
            "message": "Insufficient tokens. Please subscribe to continue using this tool.",
            "tokens_remaining": tool_sub.tokens_remaining,
            "tokens_total": tool_sub.tokens_total
        }
    
    # Get or create active session
    active_session = db.query(UserToolSession).filter(
        UserToolSession.user_id == user.id,
        UserToolSession.tool_name == tool_name,
        UserToolSession.is_active == True
    ).first()
    
    now = datetime.utcnow()
    session_timeout = timedelta(minutes=15)
    
    if not active_session or (now - active_session.last_activity_at) > session_timeout:
        # Create new session if expired or doesn't exist
        if active_session:
            active_session.is_active = False
        
        active_session = UserToolSession(
            user_id=user.id,
            tool_name=tool_name,
            session_started_at=now,
            last_activity_at=now,
            tokens_consumed=0,
            is_active=True
        )
        db.add(active_session)
    
    # Consume tokens
    tool_sub.tokens_remaining -= tokens
    active_session.tokens_consumed += tokens
    active_session.last_activity_at = now
    db.commit()
    
    return {
        "success": True,
        "tokens_remaining": tool_sub.tokens_remaining,
        "tokens_total": tool_sub.tokens_total,
        "session_tokens_consumed": active_session.tokens_consumed,
        "message": f"Consumed {tokens} token(s) in this session"
    }


@router.post("/unsubscribe-tool")
async def unsubscribe_from_tool(
    tool_name: str,
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unsubscribe from a specific tool"""
    tool_subscription = db.query(UserToolSubscription).filter(
        UserToolSubscription.user_id == user.id,
        UserToolSubscription.tool_name == tool_name,
        UserToolSubscription.is_active == True
    ).first()
    
    if not tool_subscription:
        raise HTTPException(status_code=404, detail="Tool subscription not found")
    
    tool_subscription.is_active = False
    tool_subscription.subscription_status = "cancelled"
    tool_subscription.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Successfully unsubscribed from {tool_subscription.tool_display_name}"
    }

