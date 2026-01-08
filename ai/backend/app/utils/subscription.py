"""
Utility functions for subscription and trial management
"""
from fastapi import HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from app.db.models.subscription import UserAccount
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

