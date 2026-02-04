from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Dict, Any
from app.services.routing_service import RoutingService

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
    await RoutingService.register_agent_presence(agent_id, status, skills, queues)
    return {"success": True, "status": status}

@router.get("/queues")
async def get_queue_stats():
    """
    Get current queue statistics.
    """
    stats = await RoutingService.get_queue_stats()
    return stats

@router.get("/queues/calls")
async def get_queued_calls(queue: str = None):
    """
    Get detailed list of queued calls.
    """
    calls = await RoutingService.get_queued_calls(queue)
    return calls

@router.post("/call/{session_id}/accept")
async def accept_call(
    session_id: str,
    agent_id: str = Body(..., embed=True)
):
    """
    Agent accepts a call.
    """
    success = await RoutingService.assign_call(session_id, agent_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to accept call")
    return {"success": True, "session_id": session_id}
