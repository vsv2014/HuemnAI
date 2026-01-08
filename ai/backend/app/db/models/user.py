from sqlalchemy import Column, Integer, String, JSON, Text
from app.db.base import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True)
    name = Column(String, nullable=True)
    
    # Enhanced fields for agent capabilities
    skills = Column(JSON, nullable=True)  # List of skills/expertise areas
    max_ticket_load = Column(Integer, default=10)  # Maximum tickets an agent can handle
    department = Column(String, nullable=True)  # Department/team
    linkedin_profile = Column(String, nullable=True)  # LinkedIn profile URL for HR
    notes = Column(Text, nullable=True)  # Additional notes
