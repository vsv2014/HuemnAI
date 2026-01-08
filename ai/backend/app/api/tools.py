"""
Public API endpoints for tool configuration (operation mode, etc.)
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from app.core.tool_registry import get_tool, save_config, list_tools
from app.db.session import get_db
from app.db.models.tool_config import ToolConfig
from sqlalchemy.orm import Session

router = APIRouter()


class OperationModeRequest(BaseModel):
    operation_mode: str  # "independent" | "integrated"


@router.post("/{tool_name}/operation-mode")
async def set_tool_operation_mode(
    tool_name: str,
    payload: OperationModeRequest,
    db: Session = Depends(get_db)
):
    """Set tool operation mode (independent or integrated)"""
    if payload.operation_mode not in ["independent", "integrated"]:
        raise HTTPException(
            status_code=400,
            detail="operation_mode must be 'independent' or 'integrated'"
        )
    
    try:
        save_config(tool_name, operation_mode=payload.operation_mode)
        
        # Also update in database directly
        tool_config = db.query(ToolConfig).filter(ToolConfig.name == tool_name).first()
        if tool_config:
            tool_config.operation_mode = payload.operation_mode
            db.commit()
        
        return {
            "success": True,
            "tool_name": tool_name,
            "operation_mode": payload.operation_mode,
            "message": f"Tool {tool_name} set to {payload.operation_mode} mode"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set operation mode: {str(e)}")


@router.get("/{tool_name}/operation-mode")
async def get_tool_operation_mode(
    tool_name: str,
    db: Session = Depends(get_db)
):
    """Get tool operation mode"""
    try:
        tool_config = db.query(ToolConfig).filter(ToolConfig.name == tool_name).first()
        if tool_config:
            operation_mode = getattr(tool_config, 'operation_mode', 'integrated') or 'integrated'
        else:
            # Check runtime registry
            tool_entry = get_tool(tool_name)
            if tool_entry:
                operation_mode = tool_entry.operation_mode
            else:
                operation_mode = "integrated"  # default
        
        return {
            "success": True,
            "tool_name": tool_name,
            "operation_mode": operation_mode
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get operation mode: {str(e)}")


@router.get("/{tool_name}/config")
async def get_tool_config(
    tool_name: str,
    db: Session = Depends(get_db)
):
    """Get full tool configuration"""
    try:
        tool_config = db.query(ToolConfig).filter(ToolConfig.name == tool_name).first()
        tool_entry = get_tool(tool_name)
        
        if not tool_config and not tool_entry:
            raise HTTPException(status_code=404, detail="Tool not found")
        
        operation_mode = "integrated"
        if tool_config:
            operation_mode = getattr(tool_config, 'operation_mode', 'integrated') or 'integrated'
        elif tool_entry:
            operation_mode = tool_entry.operation_mode
        
        return {
            "success": True,
            "tool_name": tool_name,
            "operation_mode": operation_mode,
            "enabled": tool_config.enabled if tool_config else (tool_entry.enabled if tool_entry else False),
            "has_connector": bool(tool_config and tool_config.credentials) if tool_config else False
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get tool config: {str(e)}")

