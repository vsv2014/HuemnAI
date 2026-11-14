from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime

from app.db.session import get_db
from app.db.models.agent import Agent, AgentAnalyticsEvent, AgentConversation, AgentNode
from app.api.auth import get_current_user
from app.db.models.subscription import UserAccount

router = APIRouter()

class TraceStep(BaseModel):
    id: int
    timestamp: datetime
    event_type: str
    event_name: Optional[str] = None
    node_id: Optional[int] = None
    node_name: Optional[str] = None
    node_type: Optional[str] = None
    duration_ms: Optional[float] = None
    status: Optional[str] = None
    input: Optional[Dict[str, Any]] = None
    output: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class TraceResponse(BaseModel):
    conversation_id: int
    agent_id: int
    user_id: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    total_steps: int
    status: str
    steps: List[TraceStep]

@router.get("/{conversation_id}", response_model=TraceResponse)
async def get_conversation_trace(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user)
):
    """
    Get full execution trace for a specific conversation session.
    Aggregates analytics events into a coherent timeline.
    """
    # 1. Get Conversation Details
    conversation = db.query(AgentConversation).filter(AgentConversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    owner = db.query(Agent).filter(Agent.id == conversation.agent_id, Agent.user_id == current_user.id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # 2. Get All Events
    events = db.query(AgentAnalyticsEvent).filter(
        AgentAnalyticsEvent.conversation_id == conversation_id
    ).order_by(AgentAnalyticsEvent.created_at.asc()).all()

    if not events:
        return TraceResponse(
            conversation_id=conversation_id,
            agent_id=conversation.agent_id,
            user_id=conversation.user_id,
            total_steps=0,
            status="empty",
            steps=[]
        )

    # 3. Pre-fetch Nodes for Names
    node_ids = {e.node_id for e in events if e.node_id}
    nodes = {}
    if node_ids:
        nodes_db = db.query(AgentNode).filter(AgentNode.id.in_(node_ids)).all()
        nodes = {n.id: n for n in nodes_db}

    # 4. Construct Steps
    steps = []
    for event in events:
        props = event.properties or {}
        
        # Enrich with node info
        node_name = None
        node_type = None
        if event.node_id and event.node_id in nodes:
            node = nodes[event.node_id]
            node_name = node.name
            node_type = getattr(node.node_type, "value", str(node.node_type))

        step = TraceStep(
            id=event.id,
            timestamp=event.created_at,
            event_type=event.event_type,
            event_name=event.event_name,
            node_id=event.node_id,
            node_name=node_name,
            node_type=node_type,
            duration_ms=props.get("duration_ms"),
            status=props.get("status"),
            input=props.get("inputs") or props.get("context_in"),
            output=props.get("outputs") or props.get("result"),
            error=props.get("error")
        )
        steps.append(step)

    # 5. Determine Overall Status
    status = "completed"
    if any(s.event_type in ["error", "exception"] for s in steps):
        status = "failed"
    elif not conversation.is_active:
        status = "ended"
    else:
        status = "active" if not conversation.ended_at else "ended"

    return TraceResponse(
        conversation_id=conversation_id,
        agent_id=conversation.agent_id,
        user_id=conversation.user_id,
        start_time=events[0].created_at,
        end_time=events[-1].created_at,
        total_steps=len(steps),
        status=status,
        steps=steps
    )
