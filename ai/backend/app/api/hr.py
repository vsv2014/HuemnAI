from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.services import hr_service

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

@router.post("/")
async def hr_chat(payload: dict):
    """Legacy chat endpoint"""
    return hr_service.handle_hr_request(payload.get("message", ""))
