# app/api/status.py
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any
from app.services.status_service import (
    update_status,
    get_available_agents,
    get_agent_status,
    record_activity,
    get_all_agents_status
)

router = APIRouter()


class StatusPayload(BaseModel):
    user_id: str
    status: str  # online, offline, busy, away, lunch, break, meeting, training, leaves


class ActivityPayload(BaseModel):
    user_id: str


@router.post("/")
async def set_status(payload: StatusPayload):
    """
    Update agent status (online, busy, away, offline).
    Part of the Status Updater tool.
    """
    update_status(payload.user_id, payload.status)
    return {
        "updated": True,
        "user_id": payload.user_id,
        "status": payload.status
    }


@router.post("/activity")
async def record_user_activity(payload: ActivityPayload):
    """
    Record user activity (mouse movement, keyboard input, etc.).
    Used by Status Updater to track activity and auto-update status.
    """
    record_activity(payload.user_id)
    return {
        "recorded": True,
        "user_id": payload.user_id
    }


@router.get("/available")
async def get_available():
    """
    Get list of available agents.
    Used by Ticket Assigner to find suitable agents.
    """
    agents = get_available_agents()
    return {
        "agents": agents,
        "count": len(agents)
    }


@router.get("/{user_id}")
async def get_status(user_id: str):
    """Get detailed status for a specific agent"""
    status = get_agent_status(user_id)
    if not status:
        return {
            "user_id": user_id,
            "status": "not_found"
        }
    return status


@router.get("/")
async def get_all_status():
    """Get status for all agents"""
    return get_all_agents_status()
