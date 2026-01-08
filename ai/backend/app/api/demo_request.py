from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from app.services.email_service import send_demo_thank_you_email
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class DemoRequest(BaseModel):
    name: str
    email: EmailStr
    company: str
    phone: Optional[str] = None
    selected_tools: List[str]
    use_case: str


@router.post("/demo-request")
async def submit_demo_request(request: DemoRequest):
    """
    Submit a demo request. Sends a thank you email to the user.
    """
    try:
        # Send thank you email
        email_sent = await send_demo_thank_you_email(
            name=request.name,
            email=request.email,
            company=request.company,
            selected_tools=request.selected_tools,
            use_case=request.use_case,
        )

        if not email_sent:
            logger.warning(f"Failed to send email to {request.email}, but request was recorded")

        return {
            "success": True,
            "message": "Demo request submitted successfully. Check your email for confirmation.",
            "email_sent": email_sent,
        }
    except Exception as e:
        logger.error(f"Error processing demo request: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process demo request: {str(e)}"
        )

