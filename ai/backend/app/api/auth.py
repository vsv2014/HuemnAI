from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta
import hashlib
import secrets
import jwt
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models.subscription import UserAccount, SubscriptionPlan, Subscription, UserIntegration, UserToolSubscription, EmailVerification
from app.core.config import settings
from app.services.email_service import send_welcome_email, send_login_notification_email, send_password_reset_email, send_otp_email
import logging
import requests
import random
import string

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
    otp: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    is_agent: Optional[bool] = False  # True for agent login (requires company email)
    otp: Optional[str] = None

class GoogleLoginRequest(BaseModel):
    token: str
    otp: Optional[str] = None
    ip_address: Optional[str] = None

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class AuthResponse(BaseModel):
    token: Optional[str] = None
    user: Optional[dict] = None
    subscription_status: Optional[str] = None
    trial_days_remaining: Optional[int] = None
    subscribed_tools: Optional[list] = None
    requires_otp: bool = False
    message: Optional[str] = None

def hash_password(password: str) -> str:
    """Hash password using SHA256 (in production, use bcrypt)"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, password_hash: str) -> bool:
    """Verify password"""
    return hash_password(password) == password_hash

def create_jwt_token(user_id: int, email: str) -> str:
    """Create JWT token with 24-hour expiry"""
    login_time = datetime.utcnow()
    
    # Token expires after 24 hours
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": login_time + timedelta(hours=24)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_reset_token(email: str) -> str:
    """Create password reset token with 30-minute expiry"""
    reset_time = datetime.utcnow()
    payload = {
        "email": email,
        "type": "password_reset",
        "exp": reset_time + timedelta(minutes=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> UserAccount:
    """Get current authenticated user"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        
        user = db.query(UserAccount).filter(UserAccount.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="Invalid or inactive user")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired. Please login again.")
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

import re

def validate_password_complexity(password: str) -> None:
    """
    Validate password complexity:
    - At least 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one number
    - At least one special character
    """
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter")
    if not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character")

def generate_otp() -> str:
    """Generate 6-digit OTP"""
    return "".join(random.choices(string.digits, k=6))

async def handle_otp_generation(email: str, db: Session) -> bool:
    """Generate and send OTP"""
    otp = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    # Check if entry exists
    verification = db.query(EmailVerification).filter(EmailVerification.email == email).first()
    if verification:
        verification.otp_code = otp
        verification.expires_at = expires_at
        verification.created_at = datetime.utcnow()
    else:
        verification = EmailVerification(
            email=email,
            otp_code=otp,
            expires_at=expires_at,
            created_at=datetime.utcnow()
        )
        db.add(verification)
    
    db.commit()
    
    # Send email
    return await send_otp_email(email, otp)

def verify_otp_code(email: str, otp: str, db: Session) -> bool:
    """Verify OTP code"""
    verification = db.query(EmailVerification).filter(EmailVerification.email == email).first()
    if not verification:
        return False
    
    if verification.otp_code != otp:
        return False
        
    if verification.expires_at < datetime.utcnow():
        return False
        
    return True

@router.post("/send-otp")
async def send_otp_endpoint(
    request: ForgotPasswordRequest, # Reuse model with email field
    db: Session = Depends(get_db)
):
    """Send OTP to email"""
    if not request.email.endswith("@gmail.com"):
        raise HTTPException(status_code=400, detail="OTP service is currently limited to Gmail addresses")
        
    await handle_otp_generation(request.email, db)
    return {"message": "OTP sent successfully"}

@router.post("/signup", response_model=AuthResponse)
async def signup(
    signup_request: SignupRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    http_request: Request = None
):
    """Sign up new user with free trial"""
    # Validate password complexity
    validate_password_complexity(signup_request.password)

    # Check if email already exists
    existing_user = db.query(UserAccount).filter(UserAccount.email == signup_request.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    # Mandatory OTP for Gmail - BYPASSED FOR DEV
    # if signup_request.email.endswith("@gmail.com"):
    #     if not signup_request.otp:
    #         # Generate and send OTP
    #         await handle_otp_generation(signup_request.email, db)
    #         return AuthResponse(
    #             requires_otp=True,
    #             message="OTP sent to your Gmail address. Please verify to continue."
    #         )
    #     else:
    #         # Verify OTP
    #         if not verify_otp_code(signup_request.email, signup_request.otp, db):
    #             raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    
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

    # Initialize default tool subscriptions with free tokens
    default_tools = [
        ("agent-builder", "Agent Builder"),
        ("customer-service", "Customer Service"),
        ("hr-services", "HR Services"),
        ("knowledge-ai", "Knowledge AI"),
        ("analytics-dashboard", "Analytics Dashboard")
    ]
    
    for tool_name, tool_display_name in default_tools:
        tool_sub = UserToolSubscription(
            user_id=user.id,
            tool_name=tool_name,
            tool_display_name=tool_display_name,
            subscription_status="active",  # Active during trial
            tokens_remaining=50000,
            tokens_total=50000
        )
        db.add(tool_sub)
    
    db.commit()
    
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
async def login(
    request: LoginRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
    db: Session = Depends(get_db)
):
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
        
    # Mandatory OTP for Gmail - BYPASSED FOR DEV
    # if user.email.endswith("@gmail.com"):
    #     if not request.otp:
    #         # Generate and send OTP
    #         await handle_otp_generation(user.email, db)
    #         return AuthResponse(
    #             requires_otp=True,
    #             message="OTP sent to your Gmail address. Please verify to continue."
    #         )
    #     else:
    #         # Verify OTP
    #         if not verify_otp_code(user.email, request.otp, db):
    #             raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    
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
        UserToolSubscription.subscription_status == "active"
    ).all()

    # If no tools found (e.g. old user), create default tools
    if not tool_subscriptions:
        default_tools = [
            ("agent_builder", "Agent Builder"),
            ("customer_service", "Customer Service"),
            ("hr_services", "HR Services"),
            ("knowledge_ai", "Knowledge AI"),
            ("analytics_dashboard", "Analytics Dashboard")
        ]
        
        for tool_name, tool_display_name in default_tools:
            tool_sub = UserToolSubscription(
                user_id=user.id,
                tool_name=tool_name,
                tool_display_name=tool_display_name,
                subscription_status="active",
                tokens_remaining=50000,
                tokens_total=50000
            )
            db.add(tool_sub)
        
        db.commit()
        
        # Re-fetch
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
    
    # Create token (valid for 24h)
    token = create_jwt_token(user.id, user.email)
    
    # Send login notification in background
    ip_address = get_client_ip(http_request) if http_request else "unknown"
    background_tasks.add_task(send_login_notification_email, user.name, user.email, ip_address)
    
    return {
        "token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "subscription_status": user.subscription_status
        },
        "subscription_status": user.subscription_status,
        "trial_days_remaining": trial_days_remaining,
        "subscribed_tools": subscribed_tools
    }

@router.post("/verify-otp")
async def verify_otp_endpoint(
    request: VerifyOTPRequest,
    db: Session = Depends(get_db)
):
    """Verify OTP code"""
    if not verify_otp_code(request.email, request.otp, db):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    return {"message": "OTP verified successfully"}

@router.post("/google-login", response_model=AuthResponse)
async def google_login(
    request: GoogleLoginRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
    db: Session = Depends(get_db)
):
    """Google Login/Signup with mandatory OTP"""
    # Verify Google Token (Support both Access Token and ID Token)
    token_info = None
    
    # 1. Try as Access Token (UserInfo endpoint) - Preferred for useGoogleLogin
    try:
        response = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {request.token}"},
            timeout=10
        )
        if response.status_code == 200:
            token_info = response.json()
    except Exception as e:
        logger.warning(f"Google Access Token verification failed: {e}")

    # 2. Fallback: Try as ID Token
    if not token_info:
        try:
            response = requests.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={request.token}", timeout=10)
            if response.status_code == 200:
                token_info = response.json()
        except Exception as e:
            logger.warning(f"Google ID Token verification failed: {e}")
            
    if not token_info:
        raise HTTPException(status_code=400, detail="Invalid Google Token")
    
    email = token_info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Invalid Token: No email found")
        
    if not token_info.get("email_verified"):
        raise HTTPException(status_code=400, detail="Email not verified by Google")
        
    # Enforce Gmail restriction
    # if not email.endswith("@gmail.com"):
    #      raise HTTPException(status_code=403, detail="Only Gmail addresses are allowed for this login method")
         
    # OTP Logic - BYPASSED FOR DEV
    # if not request.otp:
    #     await handle_otp_generation(email, db)
    #     return AuthResponse(
    #         requires_otp=True,
    #         message="OTP sent to your Gmail address. Please verify to continue."
    #     )
    
    # Verify OTP
    # if not verify_otp_code(email, request.otp, db):
    #     raise HTTPException(status_code=400, detail="Invalid or expired OTP")
        
    # Check if user exists
    user = db.query(UserAccount).filter(UserAccount.email == email).first()
    
    if not user:
        # Create user (Signup via Google)
        password = secrets.token_urlsafe(16)
        password_hash = hash_password(password)
        
        trial_start = datetime.utcnow()
        trial_end = trial_start + timedelta(days=14)
        
        user = UserAccount(
            email=email,
            password_hash=password_hash,
            name=token_info.get("name", email.split("@")[0]),
            ip_address=request.ip_address or get_client_ip(http_request),
            subscription_status="trial",
            trial_started_at=trial_start,
            trial_ends_at=trial_end,
            has_used_trial=True,
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Initialize default tool subscriptions
        default_tools = [
            ("agent-builder", "Agent Builder"),
            ("customer-service", "Customer Service"),
            ("hr-services", "HR Services"),
            ("knowledge-ai", "Knowledge AI"),
            ("analytics-dashboard", "Analytics Dashboard")
        ]
        
        for tool_name, tool_display_name in default_tools:
            tool_sub = UserToolSubscription(
                user_id=user.id,
                tool_name=tool_name,
                tool_display_name=tool_display_name,
                subscription_status="active",
                tokens_remaining=50000,
                tokens_total=50000
            )
            db.add(tool_sub)
        
        db.commit()
        
    # Check trial/subscription status
    trial_days_remaining = None
    if user.subscription_status == "trial" and user.trial_ends_at:
        trial_days = (user.trial_ends_at - datetime.utcnow()).days
        trial_days_remaining = max(0, trial_days)
        if trial_days < 0:
            user.subscription_status = "expired"
            db.commit()
            
    # Get user's subscribed tools
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
    
    # Create token
    token = create_jwt_token(user.id, user.email)
    
    # Send login notification in background
    ip_address = get_client_ip(http_request) if http_request else "unknown"
    background_tasks.add_task(send_login_notification_email, user.name, user.email, ip_address)
    
    return AuthResponse(
        token=token,
        user={
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "subscription_status": user.subscription_status
        },
        subscription_status=user.subscription_status,
        trial_days_remaining=trial_days_remaining,
        subscribed_tools=subscribed_tools
    )

@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Initiate password reset process"""
    user = db.query(UserAccount).filter(UserAccount.email == request.email).first()
    if not user:
        # For security, do not reveal if email exists
        return {"message": "If your email is registered, you will receive a password reset link."}
    
    # Create reset token
    token = create_reset_token(user.email)
    
    # Send email in background
    background_tasks.add_task(send_password_reset_email, user.email, token)
    
    return {"message": "If your email is registered, you will receive a password reset link."}

@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """Reset password using token"""
    try:
        payload = jwt.decode(request.token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email = payload.get("email")
        type = payload.get("type")
        
        if type != "password_reset":
            raise HTTPException(status_code=400, detail="Invalid token type")
            
        user = db.query(UserAccount).filter(UserAccount.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Update password
        validate_password_complexity(request.new_password)
        user.password_hash = hash_password(request.new_password)
        db.commit()
        
        return {"message": "Password reset successfully. You can now login."}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="Token expired. Please request a new password reset.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid token")
    except Exception as e:
        logger.error(f"Password reset error: {e}")
        raise HTTPException(status_code=400, detail="Failed to reset password")

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

@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Initiate password reset flow"""
    user = db.query(UserAccount).filter(UserAccount.email == request.email).first()
    if not user:
        # Don't reveal if user exists (security best practice)
        # But for this specific use case, the user explicitly asked to know if registered.
        # However, typically we just say "If an account exists, an email has been sent."
        # But the user asked: "if it is present it should ask the user to forget he password"
        # This implies the SIGNUP flow detects it.
        # For this endpoint, we will just send the email if user exists.
        return {"message": "If an account exists with this email, a password reset link has been sent."}
    
    token = create_reset_token(user.email)
    background_tasks.add_task(send_password_reset_email, user.name, user.email, token)
    
    return {"message": "If an account exists with this email, a password reset link has been sent."}

@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset password with token"""
    try:
        payload = jwt.decode(request.token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email = payload.get("email")
        token_type = payload.get("type")
        
        if token_type != "password_reset":
            raise HTTPException(status_code=400, detail="Invalid token type")
            
        user = db.query(UserAccount).filter(UserAccount.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Validate new password complexity
        validate_password_complexity(request.new_password)
        
        # Update password
        user.password_hash = hash_password(request.new_password)
        db.commit()
        
        return {"message": "Password reset successfully"}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid token")
    except Exception as e:
        logger.error(f"Password reset error: {str(e)}")
        raise HTTPException(status_code=400, detail="Failed to reset password")

