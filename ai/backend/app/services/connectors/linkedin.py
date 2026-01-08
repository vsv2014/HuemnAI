"""LinkedIn connector for profile search and job posting"""
from typing import List, Dict, Optional
import os

# Mock profiles for development
MOCK_PROFILES = [
    {
        "id": "L-1",
        "name": "Carol Johnson",
        "email": "carol@example.com",
        "headline": "Senior Software Engineer",
        "skills": ["Python", "AWS", "Docker", "Kubernetes"],
        "experience_years": 5,
        "current_title": "Senior Software Engineer",
        "profile_url": "https://linkedin.com/in/carol-johnson",
        "location": "San Francisco, CA"
    },
    {
        "id": "L-2",
        "name": "Dave Martinez",
        "email": "dave@example.com",
        "headline": "Frontend Lead Developer",
        "skills": ["React", "TypeScript", "Node.js", "JavaScript"],
        "experience_years": 7,
        "current_title": "Frontend Lead",
        "profile_url": "https://linkedin.com/in/dave-martinez",
        "location": "New York, NY"
    },
    {
        "id": "L-3",
        "name": "Alice Chen",
        "email": "alice@example.com",
        "headline": "Full Stack Developer",
        "skills": ["Python", "React", "PostgreSQL", "AWS"],
        "experience_years": 4,
        "current_title": "Full Stack Developer",
        "profile_url": "https://linkedin.com/in/alice-chen",
        "location": "Seattle, WA"
    },
    {
        "id": "L-4",
        "name": "Bob Smith",
        "email": "bob@example.com",
        "headline": "DevOps Engineer",
        "skills": ["AWS", "Docker", "Kubernetes", "Terraform", "CI/CD"],
        "experience_years": 6,
        "current_title": "DevOps Engineer",
        "profile_url": "https://linkedin.com/in/bob-smith",
        "location": "Austin, TX"
    },
]


def search_profiles(query: str, limit: int = 10) -> List[Dict]:
    """
    Search LinkedIn profiles based on query.
    In production, this would use LinkedIn API.
    """
    query_lower = query.lower()
    results = []
    
    for profile in MOCK_PROFILES:
        score = 0
        
        # Match on name
        if query_lower in profile.get("name", "").lower():
            score += 10
        
        # Match on headline
        if query_lower in profile.get("headline", "").lower():
            score += 8
        
        # Match on skills
        skills = [s.lower() for s in profile.get("skills", [])]
        for skill in skills:
            if query_lower in skill or skill in query_lower:
                score += 5
        
        # Match on current title
        if query_lower in profile.get("current_title", "").lower():
            score += 7
        
        if score > 0:
            profile_copy = profile.copy()
            profile_copy["match_score"] = score
            results.append(profile_copy)
    
    # Sort by match score
    results.sort(key=lambda x: x.get("match_score", 0), reverse=True)
    
    return results[:limit]


def post_job(title: str, description: str) -> Dict:
    """
    Post a job to LinkedIn.
    In production, this would use LinkedIn Job Posting API.
    """
    # Mock implementation
    job_id = f"LJ-{len(MOCK_PROFILES) + 1}"
    return {
        "id": job_id,
        "title": title,
        "description": description,
        "platform": "linkedin",
        "status": "active",
        "url": f"https://linkedin.com/jobs/view/{job_id}"
    }


def get_profile(profile_id: str) -> Optional[Dict]:
    """Get a specific LinkedIn profile by ID"""
    for profile in MOCK_PROFILES:
        if profile.get("id") == profile_id:
            return profile
    return None


def validate() -> bool:
    """
    Validate LinkedIn connector credentials.
    In production, check for LinkedIn API credentials.
    """
    # Check for LinkedIn API credentials
    linkedin_token = os.getenv("LINKEDIN_API_TOKEN")
    linkedin_client_id = os.getenv("LINKEDIN_CLIENT_ID")
    
    # For development, always return True (using mock data)
    # In production, validate actual credentials
    if linkedin_token or linkedin_client_id:
        return True
    
    # Allow mock mode for development
    return True
