from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from app.services.routing_service import RoutingService
from app.db.session import get_db
from app.db.models.agent import AgentConversation, AgentMessage

router = APIRouter()

@router.post("/agent/status")
async def update_agent_status(
    agent_id: str = Body(..., embed=True),
    status: str = Body(..., embed=True),
    skills: List[str] = Body([], embed=True),
    queues: List[str] = Body(["default"], embed=True),
):
    """
    Update the current agent's status (online/busy/offline).
    """
    try:
        await RoutingService.register_agent_presence(agent_id, status, skills, queues)
        return {"success": True, "status": status}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Routing unavailable: {exc}")

@router.get("/queues")
async def get_queue_stats():
    """
    Get current queue statistics.
    """
    try:
        stats = await RoutingService.get_queue_stats()
        return stats
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Routing unavailable: {exc}")

@router.get("/queues/calls")
async def get_queued_calls(queue: str = None):
    """
    Get detailed list of queued calls.
    """
    try:
        calls = await RoutingService.get_queued_calls(queue)
        return calls
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Routing unavailable: {exc}")

@router.post("/call/{session_id}/accept")
async def accept_call(
    session_id: str,
    agent_id: str = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    """
    Agent accepts a call.
    """
    try:
        call_data = await RoutingService.get_call_data(session_id)
        call_context = call_data.get("context", {}) if call_data else {}
        voice_masking = call_context.get("voice_masking")
        ivr_voice_id = call_context.get("ivr_voice_id") or call_context.get("voice_id")
        ivr_call_sid = call_context.get("ivr_call_sid") or call_context.get("call_sid")

        success = await RoutingService.assign_call(session_id, agent_id)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to accept call")
        conversation = db.query(AgentConversation).filter(
            AgentConversation.session_id == session_id,
            AgentConversation.is_active == True
        ).first()

        if not conversation:
            context_payload = {"agent_joined": True, "agent_connected": True, "agent_id": agent_id}
            if voice_masking is not None:
                context_payload["voice_masking"] = voice_masking
            if ivr_voice_id:
                context_payload["ivr_voice_id"] = ivr_voice_id
            if ivr_call_sid:
                context_payload["ivr_call_sid"] = ivr_call_sid

            conversation = AgentConversation(
                agent_id=agent_id,
                session_id=session_id,
                channel="chat",
                context=context_payload
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)
        else:
            context = conversation.context or {}
            if not context.get("agent_joined"):
                context["agent_joined"] = True
            if not context.get("agent_connected"):
                context["agent_connected"] = True
            context["agent_id"] = agent_id
            if voice_masking is not None:
                context["voice_masking"] = voice_masking
            if ivr_voice_id:
                context["ivr_voice_id"] = ivr_voice_id
            if ivr_call_sid:
                context["ivr_call_sid"] = ivr_call_sid
            conversation.context = context
            conversation.updated_at = datetime.utcnow()
            db.commit()

        last_message = db.query(AgentMessage).filter(
            AgentMessage.conversation_id == conversation.id
        ).order_by(AgentMessage.created_at.desc(), AgentMessage.id.desc()).first()
        connection_notice = "You are now connected to a live agent."
        if not last_message or last_message.content != connection_notice:
            db.add(AgentMessage(
                conversation_id=conversation.id,
                role="assistant",
                content=connection_notice
            ))
            db.commit()

        return {
            "success": True,
            "session_id": session_id,
            "voice_masking": voice_masking,
            "ivr_voice_id": ivr_voice_id,
            "ivr_call_sid": ivr_call_sid
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Routing unavailable: {exc}")
