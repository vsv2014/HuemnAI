from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy import JSON
from sqlalchemy.sql import func
from app.db.base import Base


class ToolConfig(Base):
    __tablename__ = "tool_config"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    enabled = Column(Boolean, default=False, nullable=False)
    mode = Column(String(32), default="manual")  # manual | auto | scheduled
    schedule = Column(String(128), nullable=True)  # cron or interval
    # Tool operation mode: "independent" (standalone) or "integrated" (with external tools)
    operation_mode = Column(String(32), default="integrated")  # independent | integrated
    credentials = Column(JSON, nullable=True)
    settings = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
