from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta
import hashlib
import secrets
import jwt
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models.subscription import UserAccount, SubscriptionPlan, Subscription, UserIntegration
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)

# JWT Secret (in production, use a strong secret from env)
JWT_SECRET = settings.SECRET_KEY
JWT_ALGORITHM = "HS256"

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    ip_address: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    is_agent: Optional[bool] = False  # True for agent login (requires company email)

class AuthResponse(BaseModel):
    token: str
    user: dict
    subscription_status: str
    trial_days_remaining: Optional[int] = None

def hash_password(password: str) -> str:
    """Hash password using SHA256 (in production, use bcrypt)"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, password_hash: str) -> bool:
    """Verify password"""
    return hash_password(password) == password_hash

def create_jwt_token(user_id: int, email: str, login_time: Optional[datetime] = None) -> str:
    """Create JWT token with 8-hour expiry for security"""
    if login_time is None:
        login_time = datetime.utcnow()
    
    # Token expires after 8 hours for security
    payload = {
        "user_id": user_id,
        "email": email,
        "login_time": login_time.isoformat(),
        "exp": login_time + timedelta(hours=8)  # 8-hour auto-logout
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> UserAccount:
    """Get current authenticated user with 8-hour auto-logout check"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        login_time_str = payload.get("login_time")
        
        # Check if token is older than 8 hours
        if login_time_str:
            login_time = datetime.fromisoformat(login_time_str.replace('Z', '+00:00'))
            if login_time.tzinfo is None:
                login_time = login_time.replace(tzinfo=datetime.utcnow().tzinfo)
            hours_since_login = (datetime.utcnow() - login_time.replace(tzinfo=None)).total_seconds() / 3600
            if hours_since_login >= 8:
                raise HTTPException(status_code=401, detail="Session expired. Please login again for security.")
        
        user = db.query(UserAccount).filter(UserAccount.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="Invalid or inactive user")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired. Please login again.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
    db: Session = Depends(get_db)
) -> Optional[UserAccount]:
    """Get current authenticated user if token is present, else None"""
    if not credentials:
        return None
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        user = db.query(UserAccount).filter(UserAccount.id == user_id).first()
        if not user or not user.is_active:
            return None
        return user
    except:
        return None

def get_client_ip(request: Request) -> str:
    """Get client IP address"""
    if request.client:
        return request.client.host
    return "unknown"

@router.post("/signup", response_model=AuthResponse)
async def signup(signup_request: SignupRequest, db: Session = Depends(get_db), http_request: Request = None):
    """Sign up new user with free trial"""
    # Check if email already exists
    existing_user = db.query(UserAccount).filter(UserAccount.email == signup_request.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check IP-based trial restriction (bypassed in development mode)
    ip_address = signup_request.ip_address or (get_client_ip(http_request) if http_request else "unknown")
    
    # Only enforce IP restriction if subscription checks are enabled
    if not settings.BYPASS_SUBSCRIPTION:
        existing_ip_trial = db.query(UserAccount).filter(
            UserAccount.ip_address == ip_address,
            UserAccount.has_used_trial == True
        ).first()
        
        if existing_ip_trial:
            raise HTTPException(
                status_code=400,
                detail="Free trial already used from this IP address. Please subscribe to continue."
            )
    
    # Create user account
    password_hash = hash_password(signup_request.password)
    trial_start = datetime.utcnow()
    trial_end = trial_start + timedelta(days=14)  # 14-day free trial
    
    user = UserAccount(
        email=signup_request.email,
        password_hash=password_hash,
        name=signup_request.name,
        ip_address=ip_address,
        subscription_status="trial",
        trial_started_at=trial_start,
        trial_ends_at=trial_end,
        has_used_trial=True
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Create token
    token = create_jwt_token(user.id, user.email)
    
    # Calculate trial days remaining
    trial_days = (trial_end - datetime.utcnow()).days
    
    return AuthResponse(
        token=token,
        user={
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "subscription_status": user.subscription_status
        },
        subscription_status=user.subscription_status,
        trial_days_remaining=max(0, trial_days)
    )

@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login user"""
    user = db.query(UserAccount).filter(UserAccount.email == request.email).first()
    
    if not user:
        logger.warning(f"Login attempt with non-existent email: {request.email}")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(request.password, user.password_hash):
        logger.warning(f"Invalid password attempt for email: {request.email}")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")
    
    # Agent login: verify company email domain
    if request.is_agent:
        # Extract domain from user's email
        user_email_domain = user.email.split("@")[1] if "@" in user.email else None
        
        # Check if user belongs to a company account
        if not user.is_company_account and not user.organization_name:
            raise HTTPException(
                status_code=403,
                detail="Agent login requires a company account. Please contact your administrator."
            )
        
        # If organization_name exists, verify email domain matches
        if user.organization_name:
            # For now, we'll allow any email if user has organization_name
            # In production, you might want to verify domain matches organization
            logger.info(f"Agent login: {user.email} for organization: {user.organization_name}")
        else:
            # Check if there are other users with same domain (company)
            domain_users = db.query(UserAccount).filter(
                UserAccount.email.like(f"%@{user_email_domain}"),
                UserAccount.is_company_account == True
            ).first()
            
            if not domain_users:
                raise HTTPException(
                    status_code=403,
                    detail="Agent login requires a company email domain. Please use your company email address."
                )
    
    # Update last login
    login_time = datetime.utcnow()
    user.last_login = login_time
    db.commit()
    
    # Check trial/subscription status
    trial_days_remaining = None
    if user.subscription_status == "trial" and user.trial_ends_at:
        trial_days = (user.trial_ends_at - datetime.utcnow()).days
        trial_days_remaining = max(0, trial_days)
        if trial_days < 0:
            user.subscription_status = "expired"
            db.commit()
    
    # Get user's subscribed tools for SSO
    from app.db.models.subscription import UserToolSubscription
    tool_subscriptions = db.query(UserToolSubscription).filter(
        UserToolSubscription.user_id == user.id,
        UserToolSubscription.is_active == True,
        UserToolSubscription.subscription_status == "active"
    ).all()
    
    subscribed_tools = [{
        "tool_name": sub.tool_name,
        "tool_display_name": sub.tool_display_name,
        "subscribed_at": sub.subscribed_at.isoformat() if sub.subscribed_at else None
    } for sub in tool_subscriptions]
    
    # Create token with login time for 8-hour expiry
    token = create_jwt_token(user.id, user.email, login_time)
    
    return {
        "token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,  # Added role
            "subscription_status": user.subscription_status
        },
        "subscription_status": user.subscription_status,
        "trial_days_remaining": trial_days_remaining,
        "subscribed_tools": subscribed_tools,  # SSO: Return subscribed tools for auto-login
        "login_time": login_time.isoformat()  # Track login time for 8-hour expiry
    }

@router.get("/me")
async def get_current_user_info(user: UserAccount = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get current user information with subscription details"""
    # Get active integrations
    integrations = db.query(UserIntegration).filter(
        UserIntegration.user_id == user.id,
        UserIntegration.is_active == True
    ).all()
    
    trial_days_remaining = None
    if user.subscription_status == "trial" and user.trial_ends_at:
        trial_days = (user.trial_ends_at - datetime.utcnow()).days
        trial_days_remaining = max(0, trial_days)
    
    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "subscription_status": user.subscription_status,
            "trial_days_remaining": trial_days_remaining
        },
        "plan": {
            "id": user.subscription_plan.id if user.subscription_plan else None,
            "name": user.subscription_plan.name if user.subscription_plan else None,
            "display_name": user.subscription_plan.display_name if user.subscription_plan else None
        } if user.subscription_plan else None,
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

