"""Mock Greenhouse connector (jobs / candidates)"""
from typing import List, Dict

MOCK_JOBS = []
MOCK_CANDIDATES = [
    {"id": "C-1", "name": "Alice", "skills": ["python", "sql"], "score": 0.9},
    {"id": "C-2", "name": "Bob", "skills": ["javascript", "react"], "score": 0.8},
]


def post_job(title: str, description: str) -> Dict:
    job = {"id": f"JOB-{len(MOCK_JOBS)+1}", "title": title, "description": description}
    MOCK_JOBS.append(job)
    return job


def fetch_candidates() -> List[Dict]:
    return MOCK_CANDIDATES.copy()


def validate() -> bool:
    return True
