from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.services import hr_service, email_service
from app.api.auth import get_current_user
from app.db.models.subscription import UserAccount
from app.db.session import get_db
from app.utils.subscription import consume_tool_tokens
from sqlalchemy.orm import Session
from app.db.models.hr import HREmail

router = APIRouter()

class SearchPayload(BaseModel):
    query: str
    user_id: Optional[str] = "anonymous"

class PostJobPayload(BaseModel):
    title: str
    description: str
    requirements: Optional[List[str]] = None

class ApplicationPayload(BaseModel):
    job_id: int
    candidate_name: str
    candidate_email: str
    resume_text: Optional[str] = ""

class PostEmailPayload(BaseModel):
    title: str
    content: str
    email_address: Optional[str] = None
    type: Optional[str] = "activity"

class SendHREmailRequest(BaseModel):
    google_access_token: Optional[str] = None

@router.get("/jobs")
async def get_jobs(q: Optional[str] = None):
    """Get all active jobs, optionally filtered by query"""
    return hr_service.get_all_jobs(query=q)

@router.post("/apply")
async def apply_for_job(payload: ApplicationPayload):
    """Submit an application for a job"""
    return hr_service.apply_for_job(
        payload.job_id, 
        payload.candidate_name, 
        payload.candidate_email, 
        payload.resume_text
    )

@router.post("/search-log")
async def log_search(payload: SearchPayload):
    """Log a candidate search for HR visibility"""
    hr_service.log_search(payload.query, payload.user_id)
    return {"status": "logged"}

@router.get("/live-searches")
async def get_live_searches():
    """Get real-time feed of what candidates are searching for"""
    return hr_service.get_live_searches()

@router.post("/post-job")
async def post_job(payload: PostJobPayload):
    return hr_service.post_job(payload.title, payload.description, payload.requirements)

@router.get("/emails")
async def get_emails():
    """Get all HR emails/announcements"""
    return hr_service.get_emails()

@router.post("/emails")
async def post_email(payload: PostEmailPayload):
    """Post a new HR email/announcement"""
    return hr_service.post_email(
        payload.title, 
        payload.content, 
        payload.email_address, 
        payload.type
    )

@router.post("/emails/{email_id}/send")
async def send_hr_email(
    email_id: int,
    payload: SendHREmailRequest | None = None,
    db: Session = Depends(get_db),
):
    """Send an HR announcement email for a specific record."""
    email = db.query(HREmail).filter(HREmail.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    if not email.email_address:
        raise HTTPException(status_code=400, detail="No email address configured for this announcement")

    subject = email.title
    if email.type:
        subject = f"[HR {email.type.capitalize()}] {email.title}"

    sent = await email_service.send_hr_announcement_email(
        email.email_address,
        subject,
        email.content,
        google_access_token=payload.google_access_token if payload else None,
    )
    if not sent:
        raise HTTPException(status_code=500, detail="Failed to send email")
    return {"success": True}

@router.post("/")
async def hr_chat(
    payload: dict,
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Legacy chat endpoint"""
    consume_tool_tokens(db, user, "hr_services", 1)
    return hr_service.handle_hr_request(payload.get("message", ""))
