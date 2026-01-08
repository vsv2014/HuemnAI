from fastapi import APIRouter, Header, HTTPException
from typing import Optional
from pydantic import BaseModel
from app.core.tool_registry import list_tools, save_config, get_tool, trigger_tool
from app.core.config import settings

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
