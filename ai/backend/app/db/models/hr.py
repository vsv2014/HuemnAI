from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    department = Column(String, index=True)
    location = Column(String)
    type = Column(String)  # Full-time, Contract, etc.
    description = Column(Text)
    requirements = Column(JSON)  # List of strings
    salary_range = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    posted_at = Column(DateTime, default=datetime.utcnow)
    
    applications = relationship("Application", back_populates="job")

class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"))
    candidate_name = Column(String)
    candidate_email = Column(String)
    resume_url = Column(String, nullable=True)
    status = Column(String, default="applied")  # applied, screening, interviewing, offer, rejected
    match_score = Column(Integer, default=0)  # AI calculated score
    applied_at = Column(DateTime, default=datetime.utcnow)
    
    job = relationship("Job", back_populates="applications")

class SearchLog(Base):
    __tablename__ = "hr_search_logs"

    id = Column(Integer, primary_key=True, index=True)
    query = Column(String)
    user_identifier = Column(String, nullable=True)  # email or session ID
    timestamp = Column(DateTime, default=datetime.utcnow)

class HREmail(Base):
    __tablename__ = "hr_emails"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String) # e.g., "Company Outing Contact" or "Urgent Policy Update"
    email_address = Column(String, nullable=True) # e.g., "outing@company.com"
    content = Column(Text) # Description
    type = Column(String, default="activity") # activity, announcement
    created_at = Column(DateTime, default=datetime.utcnow)
