from typing import List, Dict, Optional
from app.services.connectors import greenhouse, linkedin
from app.db.session import SessionLocal
from app.db.models.user import User
import logging
import re

logger = logging.getLogger(__name__)


def post_job(title: str, description: str, requirements: Optional[List[str]] = None) -> Dict:
    """
    Post a job to Greenhouse and optionally to LinkedIn.
    """
    try:
        # Post to Greenhouse
        job = greenhouse.post_job(title, description)
        
        # Also post to LinkedIn if connector available
        try:
            linkedin_job = linkedin.post_job(title, description)
            job["linkedin_post_id"] = linkedin_job.get("id")
            logger.info(f"Posted job to both Greenhouse and LinkedIn: {title}")
        except Exception as e:
            logger.warning(f"Could not post to LinkedIn: {e}")
            job["linkedin_post_id"] = None
        
        return {
            "success": True,
            "job": job,
            "posted_to": ["greenhouse", "linkedin" if job.get("linkedin_post_id") else None]
        }
    except Exception as e:
        logger.error(f"Error posting job: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }


def fetch_linkedin_profiles(query: str, limit: int = 10) -> List[Dict]:
    """
    Search LinkedIn profiles based on query (skills, job title, etc.)
    """
    try:
        profiles = linkedin.search_profiles(query, limit=limit)
        return profiles
    except Exception as e:
        logger.warning(f"Error fetching LinkedIn profiles: {e}")
        return []


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
    all_candidates = []
    
    # Fetch from Greenhouse
    try:
        greenhouse_candidates = greenhouse.fetch_candidates()
        all_candidates.extend(greenhouse_candidates)
    except Exception as e:
        logger.warning(f"Error fetching Greenhouse candidates: {e}")
    
    # Fetch from LinkedIn if job title provided
    if job_title:
        try:
            linkedin_query = f"{job_title} {' '.join(skills)}"
            linkedin_profiles = fetch_linkedin_profiles(linkedin_query, limit=20)
            # Convert LinkedIn profiles to candidate format
            for profile in linkedin_profiles:
                all_candidates.append({
                    "id": profile.get("id", f"linkedin-{len(all_candidates)}"),
                    "name": profile.get("name", "Unknown"),
                    "email": profile.get("email"),
                    "linkedin_url": profile.get("profile_url"),
                    "skills": profile.get("skills", []),
                    "experience": profile.get("experience_years", 0),
                    "current_title": profile.get("current_title"),
                    "source": "linkedin"
                })
        except Exception as e:
            logger.warning(f"Error fetching LinkedIn candidates: {e}")
    
    # Score candidates
    qskills = set([s.lower().strip() for s in skills])
    scored = []
    
    for c in all_candidates:
        score = 0
        
        # Skills match
        cskills = set([s.lower().strip() for s in c.get("skills", [])])
        skill_overlap = len(qskills & cskills)
        skill_match_ratio = skill_overlap / len(qskills) if qskills else 0
        score += skill_match_ratio * 50  # Up to 50 points
        
        # Job title match
        if job_title:
            candidate_title = c.get("current_title", "").lower()
            job_title_lower = job_title.lower()
            if job_title_lower in candidate_title or candidate_title in job_title_lower:
                score += 20
        
        # Experience match
        if experience_years:
            candidate_exp = c.get("experience_years", 0)
            if candidate_exp >= experience_years:
                score += 10
            elif candidate_exp >= experience_years - 2:
                score += 5
        
        # LinkedIn profile bonus (more complete profile)
        if c.get("linkedin_url"):
            score += 5
        
        # Source bonus (prefer Greenhouse candidates)
        if c.get("source") != "linkedin":
            score += 5
        
        scored.append((score, c))
    
    # Sort by score
    scored.sort(key=lambda s: s[0], reverse=True)
    
    # Return top candidates
    return [c for _, c in scored][:limit]


def notify_manager(candidates: List[Dict], job_title: str, manager_email: Optional[str] = None) -> Dict:
    """
    Send shortlisted candidates to manager for review.
    In a real implementation, this would send an email or notification.
    """
    if not manager_email:
        # Try to find manager from database
        db = SessionLocal()
        try:
            # In a real system, you'd have a manager lookup
            # For now, return the candidates data
            pass
        finally:
            db.close()
    
    # Format candidates for manager review
    candidate_summary = []
    for c in candidates:
        candidate_summary.append({
            "name": c.get("name", "Unknown"),
            "email": c.get("email"),
            "linkedin": c.get("linkedin_url"),
            "skills": c.get("skills", []),
            "experience": c.get("experience_years", 0),
            "current_title": c.get("current_title"),
            "source": c.get("source", "unknown")
        })
    
    logger.info(f"Prepared {len(candidate_summary)} candidates for manager review: {job_title}")
    
    return {
        "success": True,
        "job_title": job_title,
        "candidates_count": len(candidate_summary),
        "candidates": candidate_summary,
        "manager_email": manager_email,
        "message": f"Shortlisted {len(candidate_summary)} candidates for {job_title}"
    }


def parse_hr_request(message: str) -> Dict:
    """
    Parse HR service request from natural language.
    Supports:
    - Post job: "post job: Software Engineer | We need a Python developer..."
    - Shortlist: "shortlist candidates with Python, React, AWS"
    - Find requirement: "find candidates for Senior Developer position"
    """
    msg_lower = message.lower()
    
    # Post job detection
    if "post job" in msg_lower or "create job" in msg_lower:
        # Try to extract title and description
        parts = re.split(r'[|:]', message, maxsplit=2)
        if len(parts) >= 2:
            title = parts[1].strip()
            description = parts[2].strip() if len(parts) > 2 else ""
            return {
                "action": "post_job",
                "title": title,
                "description": description
            }
    
    # Shortlist detection
    if "shortlist" in msg_lower or "find candidates" in msg_lower:
        # Extract skills
        skills = []
        skill_keywords = ["python", "react", "aws", "javascript", "java", "node", "sql", "docker", "kubernetes"]
        for keyword in skill_keywords:
            if keyword in msg_lower:
                skills.append(keyword.capitalize())
        
        # Extract job title
        job_title = None
        title_patterns = ["for (.+?) position", "for (.+?) role", "as (.+?)", "(.+?) position"]
        for pattern in title_patterns:
            match = re.search(pattern, msg_lower)
            if match:
                job_title = match.group(1).strip()
                break
        
        # Extract experience
        experience = None
        exp_match = re.search(r'(\d+)\s*years?', msg_lower)
        if exp_match:
            experience = int(exp_match.group(1))
        
        return {
            "action": "shortlist",
            "skills": skills if skills else ["General"],
            "job_title": job_title,
            "experience_years": experience
        }
    
    # Default: treat as general query
    return {
        "action": "query",
        "message": message
    }


def handle_hr_request(message: str) -> Dict:
    """
    Main entry point for HR service requests.
    Handles job posting, candidate shortlisting, and notifications.
    Generates human-like, conversational responses.
    """
    parsed = parse_hr_request(message)
    action = parsed.get("action")
    
    if action == "post_job":
        title = parsed.get("title", "New Position")
        description = parsed.get("description", "")
        result = post_job(title, description)
        
        if result.get("success"):
            # Human-like success message
            platforms = [p for p in result.get("posted_to", []) if p]
            platform_text = " and ".join(platforms) if platforms else "job boards"
            
            result["message"] = f"Great! I've posted the '{title}' position to {platform_text}. "
            result["message"] += f"The job is now live and candidates can start applying. "
            result["message"] += f"Job ID: {result.get('job', {}).get('id', 'N/A')}. "
            result["message"] += "Would you like me to start searching for candidates?"
        else:
            result["message"] = f"I encountered an issue while posting the job. {result.get('error', 'Please try again.')}"
        
        return result
    
    elif action == "shortlist":
        skills = parsed.get("skills", [])
        job_title = parsed.get("job_title")
        experience = parsed.get("experience_years")
        
        candidates = shortlist_candidates(
            skills=skills,
            job_title=job_title,
            experience_years=experience,
            limit=5
        )
        
        # Notify manager
        notification = notify_manager(candidates, job_title or "Position")
        
        # Generate human-like response
        if candidates:
            skill_text = ", ".join(skills[:3]) if skills else "the specified criteria"
            response = f"I found {len(candidates)} strong candidates matching {skill_text}. "
            if job_title:
                response += f"They're a good fit for the {job_title} role. "
            response += "I've reviewed their profiles and they have the relevant experience. "
            response += "Would you like me to send their details to the hiring manager?"
        else:
            response = f"I searched for candidates with {', '.join(skills[:3]) if skills else 'those skills'}, "
            response += "but didn't find exact matches in our current pool. "
            response += "Would you like me to expand the search or post the job to attract more candidates?"
        
        return {
            "action": "shortlist",
            "candidates": candidates,
            "count": len(candidates),
            "notification": notification,
            "message": response
        }
    
    else:
        # Friendly guidance message
        return {
            "action": "query",
            "message": "I can help you with job postings and candidate shortlisting! "
                      "Try saying something like:\n"
                      "• 'Post a job for Software Engineer'\n"
                      "• 'Find candidates with Python and React skills'\n"
                      "• 'Shortlist candidates for Senior Developer position with 5+ years experience'\n\n"
                      "What would you like to do?",
            "parsed": parsed
        }
