from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime

from app.db.session import get_db
from app.db.models.evaluation import EvaluationLog

router = APIRouter()

class EvaluationLogResponse(BaseModel):
    id: int
    agent_id: int
    conversation_id: Optional[int]
    node_id: Optional[int]
    input_data: Optional[Dict[str, Any]]
    primary_response: Optional[Dict[str, Any]]
    shadow_response: Optional[Dict[str, Any]]
    primary_latency_ms: Optional[float]
    shadow_latency_ms: Optional[float]
    shadow_config: Optional[Dict[str, Any]]
    similarity_score: Optional[float]
    created_at: datetime
    
    class Config:
        orm_mode = True

@router.get("/agent/{agent_id}", response_model=List[EvaluationLogResponse])
async def get_agent_evaluations(
    agent_id: int,
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db)
):
    """
    Get evaluation logs for a specific agent (Shadow Mode results).
    """
    logs = db.query(EvaluationLog).filter(
        EvaluationLog.agent_id == agent_id
    ).order_by(EvaluationLog.created_at.desc()).limit(limit).all()
    
    return logs
