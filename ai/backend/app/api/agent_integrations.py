from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime

from app.db.session import get_db
from app.db.models.agent import Agent, AgentIntegration

router = APIRouter()


class AgentIntegrationCreate(BaseModel):
    master_agent_id: int
    sub_agent_id: int
    name: Optional[str] = None
    description: Optional[str] = None
    routing_condition: Optional[Dict[str, Any]] = None
    priority: Optional[int] = 0
    pass_context: Optional[bool] = True
    merge_response: Optional[bool] = True


@router.get("/agents/{agent_id}/integrations")
async def get_agent_integrations(agent_id: int, db: Session = Depends(get_db)):
    """Get all agents integrated into this agent"""
    integrations = db.query(AgentIntegration).filter(
        AgentIntegration.master_agent_id == agent_id
    ).all()
    
    result = []
    for integration in integrations:
        sub_agent = db.query(Agent).filter(Agent.id == integration.sub_agent_id).first()
        if sub_agent:
            result.append({
                "id": integration.id,
                "sub_agent_id": integration.sub_agent_id,
                "sub_agent_name": sub_agent.name,
                "sub_agent_description": sub_agent.description,
                "name": integration.name,
                "description": integration.description,
                "routing_condition": integration.routing_condition,
                "priority": integration.priority,
                "pass_context": integration.pass_context,
                "merge_response": integration.merge_response,
                "created_at": integration.created_at.isoformat() if integration.created_at else None
            })
    
    return result


@router.post("/agents/integrations")
async def create_agent_integration(integration: AgentIntegrationCreate, db: Session = Depends(get_db)):
    """Create a new agent integration"""
    # Verify both agents exist
    master_agent = db.query(Agent).filter(Agent.id == integration.master_agent_id).first()
    if not master_agent:
        raise HTTPException(status_code=404, detail="Master agent not found")
    
    sub_agent = db.query(Agent).filter(Agent.id == integration.sub_agent_id).first()
    if not sub_agent:
        raise HTTPException(status_code=404, detail="Sub-agent not found")
    
    # Check if integration already exists
    existing = db.query(AgentIntegration).filter(
        AgentIntegration.master_agent_id == integration.master_agent_id,
        AgentIntegration.sub_agent_id == integration.sub_agent_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Integration already exists")
    
    # Create integration
    new_integration = AgentIntegration(
        master_agent_id=integration.master_agent_id,
        sub_agent_id=integration.sub_agent_id,
        name=integration.name,
        description=integration.description,
        routing_condition=integration.routing_condition,
        priority=integration.priority or 0,
        pass_context=integration.pass_context if integration.pass_context is not None else True,
        merge_response=integration.merge_response if integration.merge_response is not None else True
    )
    
    db.add(new_integration)
    db.commit()
    db.refresh(new_integration)
    
    return {
        "id": new_integration.id,
        "master_agent_id": new_integration.master_agent_id,
        "sub_agent_id": new_integration.sub_agent_id,
        "name": new_integration.name,
        "description": new_integration.description,
        "routing_condition": new_integration.routing_condition,
        "priority": new_integration.priority,
        "pass_context": new_integration.pass_context,
        "merge_response": new_integration.merge_response
    }


@router.delete("/agents/integrations/{integration_id}")
async def delete_agent_integration(integration_id: int, db: Session = Depends(get_db)):
    """Delete an agent integration"""
    integration = db.query(AgentIntegration).filter(AgentIntegration.id == integration_id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    db.delete(integration)
    db.commit()
    
    return {"message": "Integration deleted successfully"}


@router.get("/agents/{agent_id}/available-for-integration")
async def get_available_agents_for_integration(agent_id: int, db: Session = Depends(get_db)):
    """Get list of agents available for integration (excluding the current agent and already integrated ones)"""
    # Get already integrated agent IDs
    integrated_ids = db.query(AgentIntegration.sub_agent_id).filter(
        AgentIntegration.master_agent_id == agent_id
    ).all()
    integrated_ids = [id[0] for id in integrated_ids]
    
    # Get all active agents except current and already integrated
    query = db.query(Agent).filter(
        Agent.id != agent_id,
        Agent.is_active == True
    )
    if integrated_ids:
        query = query.filter(~Agent.id.in_(integrated_ids))
    
    available_agents = query.all()
    
    return [
        {
            "id": agent.id,
            "name": agent.name,
            "description": agent.description,
            "agent_type": agent.agent_type.value if agent.agent_type else None,
            "is_active": agent.is_active
        }
        for agent in available_agents
    ]

