from sqlalchemy import Column, Integer, String
from app.db.base import Base

class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(Integer, primary_key=True)
    status = Column(String)
