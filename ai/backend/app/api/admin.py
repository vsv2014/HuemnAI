from fastapi import APIRouter, Header, HTTPException, Depends
from typing import Optional
from pydantic import BaseModel
from app.core.tool_registry import list_tools, save_config, get_tool, trigger_tool
from app.core.config import settings
from app.api.auth import get_current_user_optional
from app.db.models.subscription import UserAccount

router = APIRouter()

@router.get("/health")
async def health():
    return {"status": "ok"}

class ToolConfigIn(BaseModel):
    enabled: Optional[bool]
    mode: Optional[str]
    schedule: Optional[str]
    credentials: Optional[dict]
    settings: Optional[dict]


def check_admin(x_api_key: Optional[str]):
    if settings.ADMIN_API_KEY and x_api_key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")


@router.get("/tools")
async def list_tools_endpoint(x_api_key: Optional[str] = Header(None)):
    check_admin(x_api_key)
    tools = list_tools()
    out = []
    for name, entry in tools.items():
        out.append({"name": name, "enabled": entry.enabled, "mode": entry.mode, "metadata": entry.metadata})
    return {"tools": out}


@router.get("/tools/{name}")
async def get_tool_endpoint(name: str, x_api_key: Optional[str] = Header(None)):
    check_admin(x_api_key)
    entry = get_tool(name)
    if not entry:
        raise HTTPException(status_code=404, detail="Tool not found")
    return {"name": entry.name, "enabled": entry.enabled, "mode": entry.mode, "metadata": entry.metadata}


@router.post("/tools/{name}/config")
async def update_tool_config(name: str, payload: dict, x_api_key: Optional[str] = Header(None)):
    check_admin(x_api_key)
    import logging
    logging.getLogger(__name__).debug("update_tool_config payload (raw): %s", payload)
    # map fields safely
    enabled = payload.get("enabled")
    mode = payload.get("mode")
    schedule = payload.get("schedule")
    operation_mode = payload.get("operation_mode")
    credentials = payload.get("credentials")
    settings_ = payload.get("settings")
    save_config(name, enabled=enabled, mode=mode, schedule=schedule, operation_mode=operation_mode, credentials=credentials, settings=settings_)
    return {"ok": True}


@router.post("/tools/{name}/trigger")
async def trigger_tool_endpoint(name: str, force: Optional[bool] = False, x_api_key: Optional[str] = Header(None)):
    check_admin(x_api_key)
    entry = get_tool(name)
    if not entry:
        raise HTTPException(status_code=404, detail="Tool not found")
    if not entry.enabled and not force:
        raise HTTPException(status_code=400, detail="Tool disabled")
    res = trigger_tool(name, {})
    return {"result": res}


@router.get("/agents")
async def list_all_agents_admin(
    x_api_key: Optional[str] = Header(None),
    current_user: Optional[UserAccount] = Depends(get_current_user_optional),
    skip: int = 0,
    limit: int = 100
):
    """
    Admin endpoint to list all agents with owner details and stats.
    Serves as the 'Agent Registry' for governance.
    """
    # Allow if valid x-api-key OR if user is admin
    is_admin_key = False
    try:
        if x_api_key:
            check_admin(x_api_key)
            is_admin_key = True
    except HTTPException:
        pass # Key invalid or not provided
    
    if not is_admin_key:
        if not current_user or current_user.role != "admin":
             raise HTTPException(status_code=403, detail="Requires admin privileges")
    
    from app.db.session import SessionLocal
    from app.db.models.agent import Agent, AgentConversation
    from app.db.models.subscription import UserAccount
    from sqlalchemy import func
    
    db = SessionLocal()
    try:
        # Query agents with user info
        query = db.query(
            Agent, 
            UserAccount.email, 
            func.count(AgentConversation.id).label("conversation_count")
        ).outerjoin(
            UserAccount, Agent.user_id == UserAccount.id
        ).outerjoin(
            AgentConversation, Agent.id == AgentConversation.agent_id
        ).group_by(Agent.id, UserAccount.email).offset(skip).limit(limit)
        
        results = query.all()
        
        out = []
        for agent, owner_email, conv_count in results:
            out.append({
                "id": agent.id,
                "name": agent.name,
                "description": agent.description,
                "type": agent.agent_type.value,
                "is_active": agent.is_active,
                "is_public": agent.is_public,
                "owner_email": owner_email or "System/Unknown",
                "owner_id": agent.user_id,
                "node_count": len(agent.nodes) if agent.nodes else 0,
                "conversation_count": conv_count,
                "created_at": agent.created_at.isoformat() if agent.created_at else None,
                "updated_at": agent.updated_at.isoformat() if agent.updated_at else None,
                "version": agent.version
            })
            
        return {"agents": out, "total": len(out)}
    finally:
        db.close()
