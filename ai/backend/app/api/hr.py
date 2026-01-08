from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from app.services.hr_service import (
    handle_hr_request,
    post_job,
    shortlist_candidates,
    notify_manager
)

router = APIRouter()


class HRPayload(BaseModel):
    message: str


class PostJobPayload(BaseModel):
    title: str
    description: str
    requirements: Optional[List[str]] = None


class ShortlistPayload(BaseModel):
    skills: List[str]
    job_title: Optional[str] = None
    experience_years: Optional[int] = None
    limit: int = 5


@router.post("/")
async def hr_entry(payload: HRPayload):
    """
    Main HR service endpoint.
    Handles job posting, candidate shortlisting, and manager notifications.
    Supports natural language requests.
    """
    return handle_hr_request(payload.message)


@router.post("/post-job")
async def post_job_endpoint(payload: PostJobPayload):
    """Post a job to Greenhouse and LinkedIn"""
    return post_job(payload.title, payload.description, payload.requirements)


@router.post("/shortlist")
async def shortlist_endpoint(payload: ShortlistPayload):
    """Shortlist candidates based on skills, job title, and experience"""
    candidates = shortlist_candidates(
        skills=payload.skills,
        job_title=payload.job_title,
        experience_years=payload.experience_years,
        limit=payload.limit
    )
    
    # Notify manager
    notification = notify_manager(candidates, payload.job_title or "Position")
    
    return {
        "candidates": candidates,
        "count": len(candidates),
        "notification": notification
    }
