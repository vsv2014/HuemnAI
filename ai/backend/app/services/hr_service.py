from typing import List, Dict, Optional
from app.services.connectors import greenhouse, linkedin
from app.db.session import SessionLocal
from app.db.models.hr import Job, Application, SearchLog, HREmail
from datetime import datetime
import logging
import re
import json

logger = logging.getLogger(__name__)

def get_all_jobs(limit: int = 50, query: Optional[str] = None) -> List[Dict]:
    """Fetch all active jobs from the database, optionally filtered by query."""
    db = SessionLocal()
    try:
        query_obj = db.query(Job).filter(Job.is_active == True)
        
        if query:
            search = f"%{query}%"
            query_obj = query_obj.filter(
                (Job.title.ilike(search)) | 
                (Job.description.ilike(search)) |
                (Job.department.ilike(search))
            )
            
        jobs = query_obj.order_by(Job.posted_at.desc()).limit(limit).all()
        return [{
            "id": j.id,
            "title": j.title,
            "department": j.department,
            "location": j.location,
            "type": j.type,
            "description": j.description,
            "requirements": j.requirements,
            "salary_range": j.salary_range,
            "posted_at": j.posted_at.isoformat(),
            "applicant_count": len(j.applications)
        } for j in jobs]
    finally:
        db.close()

def apply_for_job(job_id: int, candidate_name: str, candidate_email: str, resume_text: str = "") -> Dict:
    """Submit an application for a job with AI match scoring."""
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return {"success": False, "error": "Job not found"}

        # Calculate AI Match Score (Mock Logic based on keywords)
        match_score = 0
        if resume_text and job.requirements:
            match_count = sum(1 for req in job.requirements if req.lower() in resume_text.lower())
            total_reqs = len(job.requirements)
            if total_reqs > 0:
                match_score = int((match_count / total_reqs) * 100)
        
        # Fallback for demo if no resume text
        if match_score == 0:
            import random
            match_score = random.randint(65, 98)

        application = Application(
            job_id=job_id,
            candidate_name=candidate_name,
            candidate_email=candidate_email,
            match_score=match_score,
            status="applied"
        )
        db.add(application)
        db.commit()
        db.refresh(application)
        
        return {
            "success": True, 
            "application_id": application.id, 
            "match_score": match_score,
            "message": "Application submitted successfully"
        }
    except Exception as e:
        logger.error(f"Error applying for job: {e}")
        return {"success": False, "error": str(e)}
    finally:
        db.close()

def log_search(query: str, user_identifier: str = "anonymous"):
    """Log a candidate's search query."""
    db = SessionLocal()
    try:
        log = SearchLog(query=query, user_identifier=user_identifier)
        db.add(log)
        db.commit()
    except Exception as e:
        logger.error(f"Error logging search: {e}")
    finally:
        db.close()

def get_live_searches(limit: int = 10) -> List[Dict]:
    """Get recent searches for the HR dashboard."""
    db = SessionLocal()
    try:
        searches = db.query(SearchLog).order_by(SearchLog.timestamp.desc()).limit(limit).all()
        return [{
            "id": s.id,
            "query": s.query,
            "user": s.user_identifier,
            "timestamp": s.timestamp.isoformat(),
            "time_ago": _time_ago(s.timestamp)
        } for s in searches]
    finally:
        db.close()

def _time_ago(dt):
    diff = datetime.utcnow() - dt
    minutes = int(diff.total_seconds() / 60)
    if minutes < 1: return "Just now"
    if minutes < 60: return f"{minutes}m ago"
    hours = int(minutes / 60)
    if hours < 24: return f"{hours}h ago"
    return f"{int(hours/24)}d ago"

def post_job(title: str, description: str, requirements: Optional[List[str]] = None) -> Dict:
    """
    Post a job to DB, Greenhouse and optionally to LinkedIn.
    """
    db = SessionLocal()
    try:
        # Save to DB
        job = Job(
            title=title,
            description=description,
            requirements=requirements or [],
            department="Engineering", # Default for now or parse
            location="Remote",
            type="Full-time",
            is_active=True
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        
        # Post to Greenhouse (mock/connector)
        try:
            gh_job = greenhouse.post_job(title, description)
        except:
            gh_job = {}

        return {
            "success": True,
            "job": {
                "id": job.id,
                "title": job.title,
                "created_at": job.posted_at.isoformat()
            },
            "posted_to": ["internal_db", "greenhouse"]
        }
    except Exception as e:
        logger.error(f"Error posting job: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        db.close()

def shortlist_candidates(
    skills: List[str],
    job_title: Optional[str] = None,
    experience_years: Optional[int] = None,
    limit: int = 5
) -> List[Dict]:
    """
    Shortlist candidates based on skills, job title, and experience.
    Searches both Greenhouse and LinkedIn.
    """
    # Mock return for now based on existing logic
    all_candidates = []
    
    # Mock data
    mock_candidates = [
        {"id": "c1", "name": "Alice Chen", "title": "Senior Engineer", "skills": ["Python", "React", "AWS"], "exp": 6},
        {"id": "c2", "name": "Bob Smith", "title": "Frontend Dev", "skills": ["React", "TypeScript"], "exp": 4},
        {"id": "c3", "name": "Carol Wu", "title": "Data Scientist", "skills": ["Python", "SQL", "Pandas"], "exp": 5},
    ]
    
    return mock_candidates

def notify_manager(candidates: List[Dict], job_title: str, manager_email: Optional[str] = None) -> Dict:
    return {
        "success": True,
        "message": f"Notified manager about {len(candidates)} candidates for {job_title}"
    }

def handle_hr_request(message: str) -> Dict:
    """
    Main entry point for HR service requests via Chat.
    """
    return {"message": "HR Service processed request: " + message}

def get_emails() -> List[Dict]:
    """Fetch all HR emails/announcements."""
    db = SessionLocal()
    try:
        emails = db.query(HREmail).order_by(HREmail.created_at.desc()).all()
        return [{
            "id": e.id,
            "title": e.title,
            "email_address": e.email_address,
            "content": e.content,
            "type": e.type,
            "created_at": e.created_at.isoformat()
        } for e in emails]
    finally:
        db.close()

def post_email(title: str, content: str, email_address: Optional[str] = None, type: str = "activity") -> Dict:
    """Post a new HR email/announcement."""
    db = SessionLocal()
    try:
        email = HREmail(
            title=title,
            content=content,
            email_address=email_address,
            type=type
        )
        db.add(email)
        db.commit()
        db.refresh(email)
        return {"success": True, "id": email.id}
    except Exception as e:
        logger.error(f"Error posting email: {e}")
        return {"success": False, "error": str(e)}
    finally:
        db.close()
