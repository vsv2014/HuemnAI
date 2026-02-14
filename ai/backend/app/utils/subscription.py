"""
Utility functions for subscription and trial management
"""
from fastapi import HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.db.models.subscription import UserAccount, UserToolSubscription, UserToolSession
from app.core.config import settings

def check_subscription_access(user: UserAccount, required_plan: str = None) -> bool:
    """
    Check if user has active subscription or trial access.
    
    Args:
        user: UserAccount instance
        required_plan: Optional plan name required (e.g., "professional", "enterprise")
    
    Returns:
        bool: True if user has access
    
    Raises:
        HTTPException: If user doesn't have access
    """
    # Development mode: bypass subscription checks if enabled
    if settings.BYPASS_SUBSCRIPTION:
        return True
    
    # Check if user has active subscription
    if user.subscription_status == "active":
        if required_plan and user.subscription_plan:
            # Check plan hierarchy: basic < professional < enterprise
            plan_hierarchy = {"basic": 1, "professional": 2, "enterprise": 3}
            user_plan_level = plan_hierarchy.get(user.subscription_plan.name, 0)
            required_plan_level = plan_hierarchy.get(required_plan, 0)
            
            if user_plan_level < required_plan_level:
                raise HTTPException(
                    status_code=403,
                    detail=f"This feature requires {required_plan.capitalize()} plan or higher. Please upgrade your subscription."
                )
        return True
    
    # Check if user is on trial
    if user.subscription_status == "trial":
        if user.trial_ends_at and datetime.utcnow() > user.trial_ends_at:
            # Trial expired
            user.subscription_status = "expired"
            raise HTTPException(
                status_code=403,
                detail="Your free trial has expired. Please subscribe to continue using the service."
            )
        return True
    
    # User doesn't have access
    if user.subscription_status == "expired":
        raise HTTPException(
            status_code=403,
            detail="Your subscription has expired. Please renew to continue using the service."
        )
    
    raise HTTPException(
        status_code=403,
        detail="Subscription required. Please subscribe to access this feature."
    )

def get_user_subscription_info(user: UserAccount) -> dict:
    """Get user's subscription information"""
    trial_days_remaining = None
    if user.subscription_status == "trial" and user.trial_ends_at:
        trial_days = (user.trial_ends_at - datetime.utcnow()).days
        trial_days_remaining = max(0, trial_days)
    
    return {
        "subscription_status": user.subscription_status,
        "trial_days_remaining": trial_days_remaining,
        "plan": {
            "id": user.subscription_plan.id if user.subscription_plan else None,
            "name": user.subscription_plan.name if user.subscription_plan else None,
            "display_name": user.subscription_plan.display_name if user.subscription_plan else None
        } if user.subscription_plan else None
    }

def normalize_tool_name(tool_name: str) -> str:
    return tool_name.replace("-", "_").lower() if tool_name else tool_name

TOOL_DISPLAY_NAMES = {
    "agent_builder": "Agent Builder",
    "customer_service": "Customer Service & Agent Console",
    "knowledge_ai": "Knowledge AI",
    "status_updater": "Status Updater",
    "ticket_assigner": "Ticket Assigner",
    "ticket_solver": "Ticket Solver",
    "analytics_dashboard": "Analytics Dashboard",
    "crm": "CRM",
    "voice_studio": "Premium Voice Studio",
    "hr_services": "HR Services"
}

PLAN_TOOL_MATRIX = {
    "basic": [
        "agent_builder",
        "customer_service",
        "knowledge_ai",
        "status_updater",
        "ticket_assigner",
        "ticket_solver",
        "analytics_dashboard",
        "voice_studio"
    ],
    "professional": [
        "agent_builder",
        "customer_service",
        "knowledge_ai",
        "status_updater",
        "ticket_assigner",
        "ticket_solver",
        "analytics_dashboard",
        "crm",
        "voice_studio",
        "hr_services"
    ],
    "enterprise": [
        "agent_builder",
        "customer_service",
        "knowledge_ai",
        "status_updater",
        "ticket_assigner",
        "ticket_solver",
        "analytics_dashboard",
        "crm",
        "voice_studio",
        "hr_services"
    ],
    "trial": [
        "agent_builder",
        "customer_service",
        "knowledge_ai",
        "status_updater",
        "ticket_assigner",
        "ticket_solver",
        "analytics_dashboard",
        "crm",
        "voice_studio",
        "hr_services"
    ]
}

PLAN_TOKEN_LIMITS = {
    "basic": 100000,
    "professional": 500000,
    "enterprise": 1000000000,
    "trial": 10000
}

def get_plan_name(user: UserAccount) -> str:
    if user.subscription_status == "trial":
        return "trial"
    if user.subscription_plan and user.subscription_plan.name:
        return user.subscription_plan.name
    return "basic"

def get_plan_tools(plan_name: str) -> list[str]:
    return PLAN_TOOL_MATRIX.get(plan_name, PLAN_TOOL_MATRIX["basic"])

def get_plan_token_limit(plan_name: str) -> int:
    return PLAN_TOKEN_LIMITS.get(plan_name, PLAN_TOKEN_LIMITS["basic"])

def enforce_tool_access(db: Session, user: UserAccount, tool_name: str) -> None:
    plan_name = get_plan_name(user)
    normalized_name = normalize_tool_name(tool_name)
    allowed = get_plan_tools(plan_name)
    if normalized_name not in allowed:
        raise HTTPException(
            status_code=403,
            detail="This tool is not included in your current plan. Please upgrade to access it."
        )

def sync_tool_subscriptions(db: Session, user: UserAccount) -> list[UserToolSubscription]:
    plan_name = get_plan_name(user)
    allowed_tools = set(get_plan_tools(plan_name))
    token_limit = get_plan_token_limit(plan_name)
    existing = db.query(UserToolSubscription).filter(
        UserToolSubscription.user_id == user.id
    ).all()
    existing_map = {normalize_tool_name(s.tool_name): s for s in existing}

    for tool_name in allowed_tools:
        tool_sub = existing_map.get(tool_name)
        if not tool_sub:
            tool_sub = UserToolSubscription(
                user_id=user.id,
                tool_name=tool_name,
                tool_display_name=TOOL_DISPLAY_NAMES.get(tool_name, tool_name.replace("_", " ").title()),
                subscription_status="active",
                is_active=True,
                subscribed_at=datetime.utcnow(),
                tokens_remaining=token_limit,
                tokens_total=token_limit
            )
            db.add(tool_sub)
        else:
            tool_sub.is_active = True
            tool_sub.subscription_status = "active"
            tool_sub.tool_display_name = tool_sub.tool_display_name or TOOL_DISPLAY_NAMES.get(tool_name, tool_name.replace("_", " ").title())
            if tool_sub.tokens_total != token_limit:
                tool_sub.tokens_total = token_limit
                tool_sub.tokens_remaining = token_limit
            elif tool_sub.tokens_remaining is None or tool_sub.tokens_remaining > token_limit:
                tool_sub.tokens_remaining = token_limit

    for tool_sub in existing:
        normalized = normalize_tool_name(tool_sub.tool_name)
        if normalized not in allowed_tools:
            tool_sub.is_active = False
            tool_sub.subscription_status = "inactive"

    db.commit()
    return db.query(UserToolSubscription).filter(
        UserToolSubscription.user_id == user.id,
        UserToolSubscription.is_active == True,
        UserToolSubscription.subscription_status == "active"
    ).all()

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

def consume_tool_tokens(db: Session, user: UserAccount, tool_name: str, tokens: int = 1) -> UserToolSubscription:
    ensure_subscription_active(user, db)
    enforce_tool_access(db, user, tool_name)
    plan_name = get_plan_name(user)
    token_limit = get_plan_token_limit(plan_name)
    normalized_name = normalize_tool_name(tool_name)
    legacy_name = tool_name.replace("_", "-") if tool_name else tool_name
    tool_sub = db.query(UserToolSubscription).filter(
        UserToolSubscription.user_id == user.id,
        UserToolSubscription.tool_name.in_([normalized_name, legacy_name])
    ).first()
    if not tool_sub:
        tool_sub = UserToolSubscription(
            user_id=user.id,
            tool_name=normalized_name,
            tool_display_name=normalized_name.replace("_", " ").title(),
            subscription_status="active",
            is_active=True,
            subscribed_at=datetime.utcnow(),
            tokens_remaining=token_limit,
            tokens_total=token_limit
        )
        db.add(tool_sub)
        db.commit()
        db.refresh(tool_sub)
    if tool_sub.tool_name != normalized_name:
        tool_sub.tool_name = normalized_name
    if tool_sub.tokens_total is None or tool_sub.tokens_total < token_limit:
        tool_sub.tokens_total = token_limit
    if tool_sub.tokens_remaining is None or tool_sub.tokens_remaining > token_limit:
        tool_sub.tokens_remaining = token_limit
    if tool_sub.tokens_remaining < tokens:
        db.commit()
        raise HTTPException(
            status_code=403,
            detail="Insufficient tokens. Please subscribe to continue using this tool."
        )
    active_session = db.query(UserToolSession).filter(
        UserToolSession.user_id == user.id,
        UserToolSession.tool_name == normalized_name,
        UserToolSession.is_active == True
    ).first()
    now = datetime.utcnow()
    session_timeout = timedelta(minutes=15)
    if not active_session or (now - active_session.last_activity_at) > session_timeout:
        if active_session:
            active_session.is_active = False
        active_session = UserToolSession(
            user_id=user.id,
            tool_name=normalized_name,
            session_started_at=now,
            last_activity_at=now,
            tokens_consumed=0,
            is_active=True
        )
        db.add(active_session)
    tool_sub.tokens_remaining -= tokens
    tool_sub.tokens_used = (tool_sub.tokens_used or 0) + tokens
    active_session.tokens_consumed = (active_session.tokens_consumed or 0) + tokens
    active_session.last_activity_at = now
    active_session.last_consumption_at = now
    db.commit()
    return tool_sub
