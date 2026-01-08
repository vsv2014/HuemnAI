from sqlalchemy import Column, Integer, String, DateTime, Float
from sqlalchemy.sql import func
from app.db.base import Base


class StatusHistory(Base):
    """
    Tracks employee status changes for work time calculation.
    Stores when employees go online, offline, busy, away, etc.
    """
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    status = Column(String, nullable=False)  # online, offline, busy, away
    previous_status = Column(String, nullable=True)  # Previous status before change
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    duration_seconds = Column(Float, nullable=True)  # Duration in previous status (calculated later)
    
    # Metadata
    is_auto_update = Column(String, default="false")  # "true" if auto-updated by system, "false" if manual
    activity_count = Column(Integer, default=0)  # Activity count at time of status change

