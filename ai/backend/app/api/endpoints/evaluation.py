from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime

from app.db.session import get_db
from app.db.models.evaluation import EvaluationLog
from app.db.models.agent import Agent, AgentConversation
from app.api.auth import get_current_user
from app.db.models.subscription import UserAccount

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
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user)
):
    """
    Get evaluation logs for a specific agent (Shadow Mode results).
    """
    owned = db.query(Agent.id).filter(Agent.id == agent_id, Agent.user_id == current_user.id).first()
    if not owned:
        raise HTTPException(status_code=404, detail="Agent not found")

    logs = db.query(EvaluationLog).filter(
        EvaluationLog.agent_id == agent_id
    ).order_by(EvaluationLog.created_at.desc()).limit(limit).all()
    
    return logs


class RetrievalGoldenCase(BaseModel):
    query: str = Field(min_length=1, max_length=1200)
    relevant_ids: List[str] = Field(min_length=1, max_length=50)


class RetrievalEvaluationRequest(BaseModel):
    cases: List[RetrievalGoldenCase] = Field(min_length=1, max_length=10)
    k: int = Field(default=10, ge=1, le=20)


@router.post("/retrieval/run")
async def evaluate_retrieval_on_goldset(
    request: RetrievalEvaluationRequest,
    current_user: UserAccount = Depends(get_current_user),
):
    """Evaluate real tenant-scoped knowledge retrieval against labeled chunk IDs.

    Returns identifiers and aggregate ranking metrics, never document content.
    This is an explicit user operation: each case consumes an embedding call.
    """
    import asyncio
    from app.services.knowledge_service import query_crawled_knowledge
    from app.services.rag_evaluation import score_retrieval, aggregate_retrieval

    scores = []
    details = []
    for index, case in enumerate(request.cases):
        try:
            results = await asyncio.to_thread(
                query_crawled_knowledge,
                case.query,
                user_id=current_user.id,
                limit=request.k,
            )
        except Exception:
            raise HTTPException(
                status_code=502,
                detail="Retrieval evaluation could not complete. Check the embedding provider and knowledge index.",
            )
        retrieved_ids = [str(item.get("id")) for item in results]
        score = score_retrieval(case.relevant_ids, retrieved_ids, k=request.k)
        scores.append(score)
        details.append({
            "case_index": index,
            "retrieved_ids": retrieved_ids,
            "relevant_count": score.relevant_count,
            "recall_at_k": score.recall_at_k,
            "precision_at_k": score.precision_at_k,
            "reciprocal_rank_at_k": score.reciprocal_rank_at_k,
        })
    return {
        "k": request.k,
        "cases": details,
        "summary": aggregate_retrieval(scores),
        "limitations": [
            "Retrieval metrics do not measure answer groundedness or hallucinations.",
            "No document text or customer question is saved by this endpoint.",
        ],
    }


class TrajectoryEvaluationRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=255)
    required_sequence: List[str] = Field(min_length=1, max_length=50)
    forbidden_types: List[str] = Field(default_factory=list, max_length=50)
    max_error_steps: int = Field(default=0, ge=0, le=100)


@router.post("/agent/{agent_id}/trajectory/run")
async def evaluate_persisted_agent_trajectory(
    agent_id: int,
    request: TrajectoryEvaluationRequest,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    """Score *persisted* trace evidence, never caller-supplied fabricated events."""
    from app.services.trajectory_evaluation import score_trajectory

    owned = db.query(Agent.id).filter(
        Agent.id == agent_id,
        Agent.user_id == current_user.id,
    ).first()
    if not owned:
        raise HTTPException(status_code=404, detail="Agent not found")
    conversation = db.query(AgentConversation).filter(
        AgentConversation.agent_id == agent_id,
        AgentConversation.session_id == request.session_id,
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Session not found")

    trace = conversation.debug_trace if isinstance(conversation.debug_trace, list) else []
    if not trace:
        raise HTTPException(status_code=409, detail="No persisted trace to evaluate")
    result = score_trajectory(
        trace,
        request.required_sequence,
        request.forbidden_types,
        request.max_error_steps,
    )
    return {
        "agent_id": agent_id,
        "session_id": request.session_id,
        **result,
    }
