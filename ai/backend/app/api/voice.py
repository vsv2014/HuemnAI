
from fastapi import APIRouter, Depends, HTTPException, Query
from app.services.telephony_service import telephony_service
from app.api.auth import get_current_user
from app.db.models.subscription import UserAccount
from app.db.session import get_db
from app.utils.subscription import consume_tool_tokens
from sqlalchemy.orm import Session
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/token")
async def get_voice_token(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate a Twilio Voice Client token for the current user.
    """
    # Use user's email or ID as identity
    consume_tool_tokens(db, current_user, "voice_studio", 1)
    identity = str(current_user.id)
    token = telephony_service.generate_client_token(identity)
    
    if not token:
        # Return 503 Service Unavailable instead of 500
        # This allows frontend to distinguish between crash and config missing
        raise HTTPException(status_code=503, detail="Voice configuration missing or invalid. Check server logs.")
        
    return {"token": token, "identity": identity}
