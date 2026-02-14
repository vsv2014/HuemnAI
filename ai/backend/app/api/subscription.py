from fastapi import APIRouter, HTTPException, Depends, Request, Header
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models.subscription import (
    UserAccount, SubscriptionPlan, Subscription, UserIntegration, UserToolSubscription, UserToolSession
)
from app.api.auth import get_current_user
from app.utils.subscription import sync_tool_subscriptions, enforce_tool_access, get_plan_token_limit, get_plan_name
import logging
import stripe
import os
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# Stripe Configuration
stripe.api_key = settings.STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET = settings.STRIPE_WEBHOOK_SECRET
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

class SubscribeRequest(BaseModel):
    plan_id: int
    billing_period: str  # "monthly" or "yearly"
    payment_method: Optional[str] = None
    organization_name: Optional[str] = None  # For enterprise/company accounts
    organization_size: Optional[str] = None  # "small", "medium", "large", "enterprise"

class ChangePlanRequest(BaseModel):
    plan_id: int
    billing_period: str  # "monthly" or "yearly"

class SubscriptionResponse(BaseModel):
    success: bool
    message: str
    subscription: Optional[dict] = None
    checkout_url: Optional[str] = None
    session_id: Optional[str] = None

# Pricing configuration (with 50% discount for first subscription)
# Custom pricing as specified
PRICING = {
    "basic": {
        "monthly": 99.0,  # Basic plan: $99/month, First subscription: $49.50
        "yearly": 990.0,  # Basic yearly: $990/year, First subscription: $495 (save 2 months)
        "features": [
            "Access to 2 AI agents",
            "Agent Builder",
            "Customer Service Console",
            "Knowledge AI",
            "Status Updater",
            "Ticket assigner and ticket solver",
            "Basic analytics dashboard",
            "Basic integrations (Zendesk, Jira)",
            "Email support",
            "5,000 queries/month",
            "Standard response templates",
            "Basic reporting & insights",
            "Mobile app access"
        ],
        "integrations": ["zendesk", "jira"]
    },
    "professional": {
        "monthly": 299.0,  # Advanced plan: $299/month (most popular)
        "yearly": 2990.0,  # Advanced yearly: $2,990/year
        "features": [
            "Access to 5 AI agents",
            "Agent Builder",
            "Customer Service Console",
            "Knowledge AI",
            "Status Updater",
            "Premium Voice Studio",
            "Analytics dashboard (advanced)",
            "Ticket assigner and ticket solver",
            "CRM workspace",
            "Multi-channel support (Email, Chat, Social)",
            "Workflow automation",
            "All integrations (Zendesk, Jira, Salesforce, LinkedIn)",
            "Priority support",
            "50,000 queries/month",
            "Advanced knowledge base management",
            "Custom AI model training",
            "Custom response templates",
            "Advanced reporting & insights",
            "API access for integrations",
            "Team collaboration tools",
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
            "Agent Builder",
            "Customer Service Console",
            "Knowledge AI",
            "Status Updater",
            "Premium Voice Studio",
            "Analytics dashboard (enterprise)",
            "Ticket assigner and ticket solver",
            "CRM workspace",
            "Multi-channel support (Email, Chat, Social, Voice)",
            "Workflow automation",
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

def normalize_tool_name(tool_name: Optional[str]) -> Optional[str]:
    if not tool_name:
        return tool_name
    return tool_name.replace("-", "_").lower()

def ensure_subscription_active(user: UserAccount, db: Session) -> None:
    if settings.BYPASS_SUBSCRIPTION:
        return
    if user.subscription_status == "trial":
        if user.trial_ends_at and datetime.utcnow() > user.trial_ends_at:
            user.subscription_status = "expired"
            db.commit()
            raise HTTPException(
                status_code=403,
                detail="Your free trial has expired. Please subscribe to continue using the service."
            )
        return
    if user.subscription_status == "active":
        return
    if user.subscription_status == "expired":
        raise HTTPException(
            status_code=403,
            detail="Your subscription has expired. Please renew to continue using the service."
        )
    raise HTTPException(
        status_code=403,
        detail="Subscription required. Please subscribe to access this feature."
    )

def get_or_create_tool_subscription(
    db: Session,
    user: UserAccount,
    tool_name: str,
    tool_display_name: Optional[str] = None,
    create_if_missing: bool = False
):
    normalized_name = normalize_tool_name(tool_name)
    legacy_name = tool_name.replace("_", "-") if tool_name else tool_name
    tool_sub = db.query(UserToolSubscription).filter(
        UserToolSubscription.user_id == user.id,
        UserToolSubscription.tool_name.in_([normalized_name, legacy_name])
    ).first()
    changed = False
    if tool_sub:
        if tool_sub.tool_name != normalized_name:
            tool_sub.tool_name = normalized_name
            changed = True
        if tool_sub.tokens_remaining is None:
            tool_sub.tokens_remaining = 50000
            tool_sub.tokens_total = tool_sub.tokens_total or 50000
            changed = True
        if tool_sub.tokens_total is None:
            tool_sub.tokens_total = 50000
            changed = True
        if tool_display_name and not tool_sub.tool_display_name:
            tool_sub.tool_display_name = tool_display_name
            changed = True
        if changed:
            db.commit()
        return tool_sub, normalized_name
    if not create_if_missing:
        return None, normalized_name
    tool_sub = UserToolSubscription(
        user_id=user.id,
        tool_name=normalized_name,
        tool_display_name=tool_display_name or normalized_name.replace("_", " ").title(),
        subscription_status="active",
        is_active=True,
        subscribed_at=datetime.utcnow(),
        tokens_remaining=50000,
        tokens_total=50000
    )
    db.add(tool_sub)
    db.commit()
    db.refresh(tool_sub)
    return tool_sub, normalized_name

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

async def _activate_integrations(user: UserAccount, plan: SubscriptionPlan, db: Session):
    """Activate integrations based on plan"""
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

@router.post("/subscribe", response_model=SubscriptionResponse)
async def subscribe(
    request: SubscribeRequest,
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Subscribe to a plan (integrates with Stripe)"""
    # Get plan
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == request.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if plan.name == "enterprise" or not plan.price_monthly or not plan.price_yearly:
        raise HTTPException(status_code=400, detail="Enterprise plans require a custom quote. Please contact sales.")
    
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
        interval = "month"
    else:
        original_price = plan.price_yearly
        price = plan.price_yearly * (1 - discount)
        ends_at = datetime.utcnow() + timedelta(days=365)
        interval = "year"
    
    # Stripe Integration
    checkout_url = None
    session_id = None
    
    # Check for valid Stripe key
    is_stripe_configured = stripe.api_key and "placeholder" not in stripe.api_key and "CHANGE_ME" not in stripe.api_key
    
    if not is_stripe_configured:
        logger.warning("Stripe is not configured. Using mock payment flow.")
        # MOCK FLOW for development/testing
        # Create a dummy subscription record directly since we skip webhook
        subscription = Subscription(
            user_id=user.id,
            plan_id=plan.id,
            status="active",
            started_at=datetime.utcnow(),
            ends_at=ends_at,
            billing_period=request.billing_period,
            amount_paid=price
        )
        db.add(subscription)
        
        # Activate plan features/integrations
        user.subscription_plan_id = plan.id
        user.subscription_status = "active"
        user.has_used_trial = True  # Mark trial as used
        await _activate_integrations(user, plan, db)
        sync_tool_subscriptions(db, user)
        
        db.commit()
        
        return SubscriptionResponse(
            success=True,
            message="Mock subscription successful (Stripe not configured)",
            checkout_url=f"{FRONTEND_URL}/payment/success?session_id=mock_session_{datetime.utcnow().timestamp()}&mock=true",
            session_id=f"mock_session_{datetime.utcnow().timestamp()}"
        )

    try:
        # 1. Get or Create Customer
        if not user.stripe_customer_id:
            customer = stripe.Customer.create(
                email=user.email,
                name=user.name,
                metadata={"user_id": user.id}
            )
            user.stripe_customer_id = customer.id
            db.commit()
        
        customer_id = user.stripe_customer_id
        
        # 2. Create Coupon for first subscription discount if needed
        coupon_id = None
        if is_first_subscription:
            try:
                coupon = stripe.Coupon.create(
                    percent_off=50,
                    duration="once",
                    name=f"first_subscription_50_{user.id}_{int(datetime.utcnow().timestamp())}"
                )
                coupon_id = coupon.id
            except Exception as e:
                logger.warning(f"Failed to create Stripe coupon: {e}")

        # 3. Create Checkout Session
        checkout_params = {
            "customer": customer_id,
            "payment_method_types": ["card"],
            "line_items": [
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": plan.display_name,
                            "description": f"{plan.display_name} ({request.billing_period})",
                        },
                        "unit_amount": int(original_price * 100),
                        "recurring": {"interval": interval},
                    },
                    "quantity": 1,
                },
            ],
            "mode": "subscription",
            "success_url": f"{FRONTEND_URL}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
            "cancel_url": f"{FRONTEND_URL}/pricing",
            "subscription_data": {
                "metadata": {
                    "user_id": user.id,
                    "plan_id": plan.id,
                    "billing_period": request.billing_period
                }
            },
            "metadata": {
                "user_id": user.id,
                "plan_id": plan.id,
                "billing_period": request.billing_period
            }
        }
        if coupon_id:
            checkout_params["discounts"] = [{"coupon": coupon_id}]
        checkout_session = stripe.checkout.Session.create(**checkout_params)
        
        checkout_url = checkout_session.url
        session_id = checkout_session.id
        
    except Exception as e:
        logger.error(f"Stripe error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Payment initialization failed: {str(e)}")

    if checkout_url:
        return SubscriptionResponse(
            success=True,
            message="Redirecting to payment...",
            checkout_url=checkout_url,
            session_id=session_id
        )

    # Fallback error
    raise HTTPException(status_code=400, detail="Failed to create payment session")

    # Check if we should block fallback
    if os.getenv("ENV") == "prod" or os.getenv("FORCE_STRIPE") == "true":
         raise HTTPException(status_code=500, detail="Payment gateway not configured correctly. Please contact support.")

    # Fallback: Direct subscription (Development/No Stripe)
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
    await _activate_integrations(user, plan, db)
    sync_tool_subscriptions(db, user)
    
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


@router.get("/stripe-health")
async def stripe_health(
    user: UserAccount = Depends(get_current_user)
):
    key = settings.STRIPE_SECRET_KEY or ""
    configured = bool(key) and "placeholder" not in key and "CHANGE_ME" not in key
    if key.startswith("sk_live_"):
        mode = "live"
    elif key.startswith("sk_test_"):
        mode = "test"
    else:
        mode = "unknown"
    return {
        "configured": configured,
        "mode": mode,
        "webhook_configured": bool(settings.STRIPE_WEBHOOK_SECRET),
        "bypass_subscription": settings.BYPASS_SUBSCRIPTION
    }


@router.post("/change-plan")
async def change_plan(
    request: ChangePlanRequest,
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == request.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if plan.name == "enterprise" or not plan.price_monthly or not plan.price_yearly:
        raise HTTPException(status_code=400, detail="Enterprise plans require a custom quote. Please contact sales.")

    active_subscription = db.query(Subscription).filter(
        Subscription.user_id == user.id,
        Subscription.status == "active"
    ).first()
    if not active_subscription:
        raise HTTPException(status_code=404, detail="No active subscription found")

    if request.billing_period not in ["monthly", "yearly"]:
        raise HTTPException(status_code=400, detail="Invalid billing period")

    if request.billing_period == "monthly":
        new_price = plan.price_monthly
        new_ends_at = datetime.utcnow() + timedelta(days=30)
        interval = "month"
    else:
        new_price = plan.price_yearly
        new_ends_at = datetime.utcnow() + timedelta(days=365)
        interval = "year"

    is_stripe_configured = stripe.api_key and "placeholder" not in stripe.api_key and "CHANGE_ME" not in stripe.api_key
    if is_stripe_configured and active_subscription.stripe_subscription_id:
        try:
            stripe_sub = stripe.Subscription.retrieve(active_subscription.stripe_subscription_id)
            items = stripe_sub.get("items", {}).get("data", [])
            if not items:
                raise HTTPException(status_code=400, detail="Stripe subscription has no items to update")
            price = stripe.Price.create(
                currency="usd",
                unit_amount=int(new_price * 100),
                recurring={"interval": interval},
                product_data={"name": plan.display_name}
            )
            stripe.Subscription.modify(
                active_subscription.stripe_subscription_id,
                cancel_at_period_end=False,
                proration_behavior="create_prorations",
                items=[{"id": items[0]["id"], "price": price.id}],
                metadata={
                    "user_id": user.id,
                    "plan_id": plan.id,
                    "billing_period": request.billing_period
                }
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Stripe plan change error: {e}")
            raise HTTPException(status_code=400, detail=f"Plan change failed: {str(e)}")

    active_subscription.plan_id = plan.id
    active_subscription.billing_period = request.billing_period
    active_subscription.amount_paid = new_price
    active_subscription.discount_applied = 0.0
    active_subscription.ends_at = new_ends_at
    active_subscription.status = "active"
    user.current_plan_id = plan.id
    user.subscription_status = "active"
    user.subscription_started_at = datetime.utcnow()
    user.subscription_ends_at = new_ends_at
    db.commit()
    sync_tool_subscriptions(db, user)

    return {
        "success": True,
        "message": f"Subscription updated to {plan.display_name}",
        "subscription_status": user.subscription_status,
        "current_plan": {
            "id": plan.id,
            "name": plan.name,
            "display_name": plan.display_name
        },
        "active_subscription": {
            "id": active_subscription.id,
            "amount_paid": active_subscription.amount_paid,
            "billing_period": active_subscription.billing_period,
            "ends_at": active_subscription.ends_at.isoformat() if active_subscription.ends_at else None
        }
    }


@router.post("/portal")
async def create_billing_portal(
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    is_stripe_configured = stripe.api_key and "placeholder" not in stripe.api_key and "CHANGE_ME" not in stripe.api_key
    if not is_stripe_configured:
        return {
            "success": True,
            "portal_url": f"{FRONTEND_URL}/pricing?portal=mock"
        }

    if not user.stripe_customer_id:
        customer = stripe.Customer.create(
            email=user.email,
            name=user.name,
            metadata={"user_id": user.id}
        )
        user.stripe_customer_id = customer.id
        db.commit()

    portal_session = stripe.billing_portal.Session.create(
        customer=user.stripe_customer_id,
        return_url=f"{FRONTEND_URL}/pricing"
    )

    return {
        "success": True,
        "portal_url": portal_session.url
    }


@router.post("/subscribe-tool")
async def subscribe_to_tool(
    tool_name: str,
    tool_display_name: Optional[str] = None,
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Subscribe to a specific tool"""
    enforce_tool_access(db, user, tool_name)
    normalized_tool_name = normalize_tool_name(tool_name)
    # Check if user already has active subscription for this tool
    existing, normalized_tool_name = get_or_create_tool_subscription(
        db,
        user,
        normalized_tool_name,
        tool_display_name=tool_display_name,
        create_if_missing=False
    )
    
    if existing:
        return {
            "success": True,
            "message": f"Already subscribed to {existing.tool_display_name or tool_display_name or normalized_tool_name}",
            "tool_subscription": {
                "tool_name": existing.tool_name,
                "tool_display_name": existing.tool_display_name,
                "status": existing.subscription_status
            }
        }
    
    # Create tool subscription with 50,000 tokens
    tool_subscription = UserToolSubscription(
        user_id=user.id,
        tool_name=normalized_tool_name,
        tool_display_name=tool_display_name or normalized_tool_name.replace("_", " ").title(),
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
        "message": f"Successfully subscribed to {tool_display_name or normalized_tool_name}",
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
    tool_subscriptions = sync_tool_subscriptions(db, user)
    return {
        "success": True,
        "tools": [
            {
                "tool_name": sub.tool_name,
                "tool_display_name": sub.tool_display_name,
                "tokens_remaining": sub.tokens_remaining,
                "tokens_total": sub.tokens_total,
                "subscribed_at": sub.subscribed_at.isoformat() if sub.subscribed_at else None,
                "status": sub.subscription_status
            }
            for sub in tool_subscriptions
        ],
        "is_trial": user.subscription_status == "trial"
    }

@router.get("/token-status/{tool_name}")
async def get_token_status(
    tool_name: str,
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's token status for a specific tool"""
    tool_sub, normalized_tool_name = get_or_create_tool_subscription(
        db,
        user,
        tool_name,
        tool_display_name=tool_name.replace("_", " ").title(),
        create_if_missing=True
    )
    
    # Get active session for this tool
    active_session = db.query(UserToolSession).filter(
        UserToolSession.user_id == user.id,
        UserToolSession.tool_name == normalized_tool_name,
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
    ensure_subscription_active(user, db)
    enforce_tool_access(db, user, tool_name)
    tool_sub, normalized_tool_name = get_or_create_tool_subscription(
        db,
        user,
        tool_name,
        tool_display_name=tool_name.replace("_", " ").title(),
        create_if_missing=True
    )
    plan_name = get_plan_name(user)
    token_limit = get_plan_token_limit(plan_name)
    if tool_sub.tokens_total is None or tool_sub.tokens_total < token_limit:
        tool_sub.tokens_total = token_limit
    if tool_sub.tokens_remaining is None or tool_sub.tokens_remaining > token_limit:
        tool_sub.tokens_remaining = token_limit
    if tool_sub.tokens_remaining is not None and tool_sub.tokens_remaining <= 0:
        raise HTTPException(
            status_code=403,
            detail="Insufficient tokens. Please subscribe to continue using this tool."
        )
    
    # Check for existing active session
    active_session = db.query(UserToolSession).filter(
        UserToolSession.user_id == user.id,
        UserToolSession.tool_name == normalized_tool_name,
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
                tool_name=normalized_tool_name,
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
            tool_name=normalized_tool_name,
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
    ensure_subscription_active(user, db)
    tool_sub, normalized_tool_name = get_or_create_tool_subscription(
        db,
        user,
        tool_name,
        tool_display_name=tool_name.replace("_", " ").title(),
        create_if_missing=True
    )
    if tool_sub.tokens_remaining is None:
        tool_sub.tokens_remaining = 50000
        tool_sub.tokens_total = tool_sub.tokens_total or 50000
    if tool_sub.tokens_remaining < tokens:
        raise HTTPException(
            status_code=403,
            detail="Insufficient tokens. Please subscribe to continue using this tool."
        )
    
    # Get or create active session
    active_session = db.query(UserToolSession).filter(
        UserToolSession.user_id == user.id,
        UserToolSession.tool_name == normalized_tool_name,
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
            tool_name=normalized_tool_name,
            session_started_at=now,
            last_activity_at=now,
            tokens_consumed=0,
            is_active=True
        )
        db.add(active_session)
    
    # Consume tokens
    tool_sub.tokens_remaining -= tokens
    tool_sub.tokens_used = (tool_sub.tokens_used or 0) + tokens
    active_session.tokens_consumed += tokens
    active_session.last_activity_at = now
    active_session.last_consumption_at = now
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
    normalized_tool_name = normalize_tool_name(tool_name)
    tool_subscription = db.query(UserToolSubscription).filter(
        UserToolSubscription.user_id == user.id,
        UserToolSubscription.tool_name == normalized_tool_name,
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

@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Stripe webhooks"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail="Invalid signature")
        
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        
        # Retrieve user and plan from metadata
        user_id = session.get('metadata', {}).get('user_id')
        plan_id = session.get('metadata', {}).get('plan_id')
        
        if user_id and plan_id:
            user = db.query(UserAccount).filter(UserAccount.id == int(user_id)).first()
            plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == int(plan_id)).first()
            
            if user and plan:
                # Update user
                user.current_plan_id = plan.id
                user.subscription_status = "active"
                user.stripe_customer_id = session.get('customer')
                
                # Create Subscription Record
                subscription_id = session.get('subscription')
                if subscription_id:
                    # Retrieve stripe subscription to get current_period_end
                    stripe_sub = stripe.Subscription.retrieve(subscription_id)
                    ends_at = datetime.fromtimestamp(stripe_sub.current_period_end)
                    
                    subscription = Subscription(
                        user_id=user.id,
                        plan_id=plan.id,
                        status="active",
                        amount_paid=session.get('amount_total', 0) / 100.0,
                        billing_period=session.get('metadata', {}).get('billing_period', 'monthly'),
                        started_at=datetime.utcnow(),
                        ends_at=ends_at,
                        payment_method="stripe",
                        stripe_subscription_id=subscription_id,
                        stripe_checkout_session_id=session.get('id')
                    )
                    
                    user.subscription_started_at = datetime.utcnow()
                    user.subscription_ends_at = ends_at
                    
                    db.add(subscription)
                    
                    # Activate integrations
                    await _activate_integrations(user, plan, db)
                    
                    db.commit()
        
    elif event['type'] == 'invoice.payment_succeeded':
        invoice = event['data']['object']
        subscription_id = invoice.get('subscription')
        
        if subscription_id:
            subscription = db.query(Subscription).filter(Subscription.stripe_subscription_id == subscription_id).first()
            if subscription:
                # Update ends_at
                period_end = invoice.get('lines', {}).get('data', [{}])[0].get('period', {}).get('end')
                if period_end:
                    subscription.ends_at = datetime.fromtimestamp(period_end)
                    subscription.status = "active"
                    
                    # Also update user account
                    if subscription.user:
                        subscription.user.subscription_ends_at = datetime.fromtimestamp(period_end)
                        subscription.user.subscription_status = "active"
                        
                    db.commit()
        
    return {"status": "success"}

