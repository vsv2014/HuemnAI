from fastapi import APIRouter, HTTPException, Depends, Header, BackgroundTasks, Request, UploadFile, File, Form
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
import uuid
import logging
import json

logger = logging.getLogger(__name__)

from app.db.session import get_db
from app.db.models.agent import (
    Agent, AgentNode, AgentConnection, AgentFlow, 
    AgentConversation, AgentMessage, AgentType, NodeType, AgentIntegration
)
from app.services.flow_generator import FlowGenerator
from app.services.audit_service import log_audit_event
from app.db.models.subscription import UserAccount
from app.api.auth import get_current_user

router = APIRouter()


def build_node_code(node: AgentNode) -> str:
    node_type = node.node_type.value if hasattr(node.node_type, "value") else str(node.node_type)
    payload = {
        "node_id": node.id,
        "node_type": node_type,
        "name": node.name,
        "label": node.label,
        "timeout": node.timeout,
        "retry_count": node.retry_count,
        "error_handling": node.error_handling or {},
        "tags": node.tags or [],
        "description": node.description,
        "config": node.config or {},
    }
    return json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False)


# Pydantic models for request/response
class AgentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    agent_type: Optional[str] = "chatbot"  # Accept string, convert to enum in endpoint
    system_prompt: Optional[str] = None
    welcome_message: Optional[str] = None
    fallback_message: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    agent_type: Optional[AgentType] = None
    system_prompt: Optional[str] = None
    welcome_message: Optional[str] = None
    fallback_message: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None
    entry_node_id: Optional[int] = None


class NodeCreate(BaseModel):
    agent_id: int
    node_type: NodeType  # Will accept any value from NodeType enum including 'agent_delegate'
    name: str
    label: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    position_x: int = 0
    position_y: int = 0
    timeout: int = 30
    retry_count: int = 0
    error_handling: Optional[Dict[str, Any]] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    
    model_config = ConfigDict(use_enum_values=True)


class NodeUpdate(BaseModel):
    name: Optional[str] = None
    label: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    position_x: Optional[int] = None
    position_y: Optional[int] = None
    timeout: Optional[int] = None
    retry_count: Optional[int] = None
    error_handling: Optional[Dict[str, Any]] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None


class ConnectionCreate(BaseModel):
    agent_id: int
    source_node_id: int
    target_node_id: int
    condition: Optional[Dict[str, Any]] = None
    priority: int = 0
    label: Optional[str] = None


class ConnectionUpdate(BaseModel):
    condition: Optional[Dict[str, Any]] = None
    priority: Optional[int] = None
    label: Optional[str] = None


class ConversationRequest(BaseModel):
    agent_id: int
    message: str
    session_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    channel: str = "web"


class ConversationResponse(BaseModel):
    model_config = ConfigDict(extra="allow")  # Allow extra fields
    
    response: str
    session_id: str
    node_id: Optional[int] = None
    context: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    debug_trace: Optional[List[Dict[str, Any]]] = Field(default_factory=list)  # Default to empty list, not None


class GenerateFlowRequest(BaseModel):
    agent_id: int
    prompt: str


class TemplateRequest(BaseModel):
    template_id: str
    name: Optional[str] = None
    description: Optional[str] = None


@router.post("/template", response_model=Dict[str, Any])
async def create_agent_from_template(
    data: TemplateRequest,
    request: Request,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new agent from a template"""
    template_id = data.template_id
    
    # Define Templates (In a real app, fetch from DB or Registry)
    if template_id == "hr-onboarding":
        name = data.name or "HR Onboarding Assistant"
        description = data.description or "Automated onboarding flow for new hires"
        agent_type = AgentType.CHATBOT
        nodes_config = [
            {"type": NodeType.START, "name": "Start", "label": "Start", "x": 100, "y": 100, "config": {}},
            {"type": NodeType.MESSAGE, "name": "Welcome", "label": "Welcome Message", "x": 300, "y": 100, "config": {"template": "Welcome to the company! I'm here to guide you through onboarding."}},
            {"type": NodeType.CONDITION, "name": "Check Dept", "label": "Check Department", "x": 500, "y": 100, "config": {}},
            {"type": NodeType.MESSAGE, "name": "Engineering Path", "label": "Eng Instructions", "x": 700, "y": 0, "config": {"template": "Here are the engineering setup docs..."}},
            {"type": NodeType.MESSAGE, "name": "Sales Path", "label": "Sales Instructions", "x": 700, "y": 200, "config": {"template": "Here are the sales playbooks..."}},
            {"type": NodeType.END, "name": "End", "label": "End Flow", "x": 900, "y": 100, "config": {}}
        ]
        connections_config = [
            {"source": 0, "target": 1}, # Start -> Welcome
            {"source": 1, "target": 2}, # Welcome -> Check Dept
            {"source": 2, "target": 3, "label": "Engineering"}, # Check -> Eng
            {"source": 2, "target": 4, "label": "Sales"}, # Check -> Sales
            {"source": 3, "target": 5}, # Eng -> End
            {"source": 4, "target": 5}, # Sales -> End
        ]
    elif template_id == "it-helpdesk":
        name = data.name or "IT Helpdesk L1"
        description = data.description or "L1 Support Automation"
        agent_type = AgentType.CHATBOT
        nodes_config = [
            {"type": NodeType.START, "name": "Start", "label": "Start", "x": 100, "y": 100, "config": {}},
            {"type": NodeType.INTENT, "name": "Intent", "label": "Classify Issue", "x": 300, "y": 100, "config": {"intents": ["password_reset", "software_install", "wifi_issue"]}},
            {"type": NodeType.MESSAGE, "name": "Password Reset", "label": "Reset Flow", "x": 500, "y": 0, "config": {"template": "Let's reset your password..."}},
            {"type": NodeType.MESSAGE, "name": "Software", "label": "Install Flow", "x": 500, "y": 200, "config": {"template": "Which software do you need?"}},
            {"type": NodeType.END, "name": "End", "label": "End", "x": 800, "y": 100, "config": {}}
        ]
        connections_config = [
            {"source": 0, "target": 1},
            {"source": 1, "target": 2, "label": "password_reset"},
            {"source": 1, "target": 3, "label": "software_install"},
            {"source": 2, "target": 4},
            {"source": 3, "target": 4},
        ]
    else:
        # Generic Fallback Template
        name = data.name or "New Agent"
        description = data.description or "Created from template"
        agent_type = AgentType.CHATBOT
        nodes_config = [
            {"type": NodeType.START, "name": "Start", "label": "Start", "x": 100, "y": 100, "config": {}},
            {"type": NodeType.LLM, "name": "LLM", "label": "AI Response", "x": 300, "y": 100, "config": {"model": "gpt-4"}},
            {"type": NodeType.END, "name": "End", "label": "End", "x": 500, "y": 100, "config": {}}
        ]
        connections_config = [
            {"source": 0, "target": 1},
            {"source": 1, "target": 2}
        ]

    # 1. Create Agent
    agent = Agent(
        name=name,
        description=description,
        agent_type=agent_type,
        user_id=current_user.id, # Assign owner
        is_active=True
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)

    # 2. Create Nodes
    created_nodes = []
    # Map index to DB ID
    node_map = {} 

    for idx, n_conf in enumerate(nodes_config):
        node = AgentNode(
            agent_id=agent.id,
            node_type=n_conf["type"],
            name=n_conf["name"],
            label=n_conf["label"],
            config=n_conf["config"],
            position_x=n_conf["x"],
            position_y=n_conf["y"]
        )
        db.add(node)
        db.flush() # Get ID
        node_map[idx] = node.id
        created_nodes.append(node)
        
        # Set entry node if start
        if n_conf["type"] == NodeType.START:
            agent.entry_node_id = node.id

    # 3. Create Connections
    for c_conf in connections_config:
        conn = AgentConnection(
            agent_id=agent.id,
            source_node_id=node_map[c_conf["source"]],
            target_node_id=node_map[c_conf["target"]],
            label=c_conf.get("label"),
            condition=c_conf.get("condition")
        )
        db.add(conn)

    db.commit()
    
    # Audit Log
    log_audit_event(
        db=db,
        action="create_agent_template",
        resource_type="agent",
        resource_id=str(agent.id),
        details={"template_id": template_id, "name": agent.name},
        request=request,
        user_id=current_user.id
    )

    return {
        "id": agent.id,
        "name": agent.name,
        "description": agent.description,
        "nodes_created": len(created_nodes),
        "status": "success"
    }


# Helper function to get user ID (placeholder - integrate with your auth system)
def get_user_id(authorization: Optional[str] = Header(None)) -> Optional[int]:
    # TODO: Implement actual authentication
    return None


# Agent CRUD endpoints
@router.post("/", response_model=Dict[str, Any])
async def create_agent(
    agent_data: AgentCreate, 
    request: Request,
    db: Session = Depends(get_db)
):
    """Create a new agent"""
    # Handle agent_type conversion if it's a string
    agent_type = agent_data.agent_type
    if isinstance(agent_type, str):
        try:
            agent_type = AgentType(agent_type)
        except ValueError:
            agent_type = AgentType.CHATBOT  # Default to CHATBOT
    
    agent = Agent(
        name=agent_data.name,
        description=agent_data.description,
        agent_type=agent_type,
        system_prompt=agent_data.system_prompt,
        welcome_message=agent_data.welcome_message,
        fallback_message=agent_data.fallback_message or "I'm sorry, I didn't understand that. Can you please rephrase?",
        settings=agent_data.settings,
        tags=agent_data.tags
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    
    # Audit Log
    log_audit_event(
        db=db,
        action="create_agent",
        resource_type="agent",
        resource_id=str(agent.id),
        details={"name": agent.name, "type": agent.agent_type.value},
        request=request
    )
    
    return {
        "id": agent.id,
        "name": agent.name,
        "description": agent.description,
        "agent_type": agent.agent_type.value,
        "created_at": agent.created_at.isoformat() if agent.created_at else None
    }


@router.get("/", response_model=List[Dict[str, Any]])
async def list_agents(
    skip: int = 0,
    limit: int = 100,
    agent_type: Optional[AgentType] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """List all agents"""
    query = db.query(Agent)
    
    if agent_type:
        query = query.filter(Agent.agent_type == agent_type)
    if is_active is not None:
        query = query.filter(Agent.is_active == is_active)
    
    agents = query.offset(skip).limit(limit).all()
    
    return [
        {
            "id": agent.id,
            "name": agent.name,
            "description": agent.description,
            "agent_type": agent.agent_type.value,
            "is_active": agent.is_active,
            "created_at": agent.created_at.isoformat() if agent.created_at else None,
            "updated_at": agent.updated_at.isoformat() if agent.updated_at else None,
            "node_count": len(agent.nodes) if agent.nodes else 0
        }
        for agent in agents
    ]


@router.get("/{agent_id}", response_model=Dict[str, Any])
async def get_agent(agent_id: int, db: Session = Depends(get_db)):
    """Get agent details with nodes and connections"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Get all nodes
    nodes = [
        {
            "id": node.id,
            "node_type": node.node_type.value,
            "name": node.name,
            "label": node.label,
            "config": node.config,
            "position_x": node.position_x,
            "position_y": node.position_y,
            "timeout": node.timeout,
            "retry_count": node.retry_count,
            "error_handling": node.error_handling,
            "description": node.description,
            "tags": node.tags,
            "generated_code": build_node_code(node)
        }
        for node in agent.nodes
    ]
    
    # Get all connections
    connections = []
    for node in agent.nodes:
        for conn in node.outgoing_connections:
            connections.append({
                "id": conn.id,
                "source_node_id": conn.source_node_id,
                "target_node_id": conn.target_node_id,
                "condition": conn.condition,
                "priority": conn.priority,
                "label": conn.label
            })
    
    return {
        "id": agent.id,
        "name": agent.name,
        "description": agent.description,
        "agent_type": agent.agent_type.value,
        "system_prompt": agent.system_prompt,
        "welcome_message": agent.welcome_message,
        "fallback_message": agent.fallback_message,
        "settings": agent.settings,
        "tags": agent.tags,
        "is_active": agent.is_active,
        "entry_node_id": agent.entry_node_id,
        "nodes": nodes,
        "connections": connections,
        "created_at": agent.created_at.isoformat() if agent.created_at else None,
        "updated_at": agent.updated_at.isoformat() if agent.updated_at else None
    }


@router.put("/{agent_id}", response_model=Dict[str, Any])
async def update_agent(
    agent_id: int, 
    agent_data: AgentUpdate, 
    request: Request,
    db: Session = Depends(get_db)
):
    """Update an agent"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    update_data = agent_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(agent, key, value)
    
    db.commit()
    db.refresh(agent)
    
    # Audit Log
    log_audit_event(
        db=db,
        action="update_agent",
        resource_type="agent",
        resource_id=str(agent.id),
        details={"updated_fields": list(update_data.keys())},
        request=request
    )
    
    return {
        "id": agent.id,
        "name": agent.name,
        "updated_at": agent.updated_at.isoformat() if agent.updated_at else None
    }


@router.delete("/{agent_id}")
async def delete_agent(
    agent_id: int, 
    request: Request,
    db: Session = Depends(get_db)
):
    """Delete an agent"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    agent_name = agent.name # Capture name before deletion
    
    db.delete(agent)
    db.commit()
    
    # Audit Log
    log_audit_event(
        db=db,
        action="delete_agent",
        resource_type="agent",
        resource_id=str(agent_id),
        details={"name": agent_name},
        request=request
    )
    
    return {"message": "Agent deleted successfully"}


# Node endpoints
@router.post("/nodes", response_model=Dict[str, Any])
async def create_node(
    node_data: NodeCreate, 
    request: Request,
    db: Session = Depends(get_db)
):
    """Create a new node"""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == node_data.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    node = AgentNode(
        agent_id=node_data.agent_id,
        node_type=node_data.node_type,
        name=node_data.name,
        label=node_data.label,
        config=node_data.config,
        position_x=node_data.position_x,
        position_y=node_data.position_y,
        timeout=node_data.timeout,
        retry_count=node_data.retry_count,
        error_handling=node_data.error_handling,
        description=node_data.description,
        tags=node_data.tags
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    
    # Audit Log
    log_audit_event(
        db=db,
        action="create_node",
        resource_type="node",
        resource_id=str(node.id),
        details={"agent_id": node.agent_id, "type": node.node_type.value, "name": node.name},
        request=request
    )
    
    return {
        "id": node.id,
        "agent_id": node.agent_id,
        "node_type": node.node_type.value,
        "name": node.name,
        "label": node.label,
        "config": node.config,
        "position_x": node.position_x,
        "position_y": node.position_y,
        "generated_code": build_node_code(node)
    }


@router.put("/nodes/{node_id}", response_model=Dict[str, Any])
async def update_node(
    node_id: int, 
    node_data: NodeUpdate, 
    request: Request,
    db: Session = Depends(get_db)
):
    """Update a node"""
    node = db.query(AgentNode).filter(AgentNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    update_data = node_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(node, key, value)
    
    db.commit()
    db.refresh(node)
    
    # Audit Log
    log_audit_event(
        db=db,
        action="update_node",
        resource_type="node",
        resource_id=str(node.id),
        details={"agent_id": node.agent_id, "updated_fields": list(update_data.keys())},
        request=request
    )
    
    return {
        "id": node.id,
        "name": node.name,
        "config": node.config,
        "generated_code": build_node_code(node),
        "updated_at": node.updated_at.isoformat() if node.updated_at else None
    }


@router.delete("/nodes/{node_id}")
async def delete_node(
    node_id: int, 
    request: Request,
    db: Session = Depends(get_db)
):
    """Delete a node"""
    node = db.query(AgentNode).filter(AgentNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    agent_id = node.agent_id
    node_name = node.name
    
    db.delete(node)
    db.commit()
    
    # Audit Log
    log_audit_event(
        db=db,
        action="delete_node",
        resource_type="node",
        resource_id=str(node_id),
        details={"agent_id": agent_id, "name": node_name},
        request=request
    )
    
    return {"message": "Node deleted successfully"}


# Connection endpoints
@router.post("/connections", response_model=Dict[str, Any])
async def create_connection(
    conn_data: ConnectionCreate, 
    request: Request,
    db: Session = Depends(get_db)
):
    """Create a connection between nodes"""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == conn_data.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Verify nodes exist and belong to the agent
    source_node = db.query(AgentNode).filter(
        and_(AgentNode.id == conn_data.source_node_id, AgentNode.agent_id == conn_data.agent_id)
    ).first()
    target_node = db.query(AgentNode).filter(
        and_(AgentNode.id == conn_data.target_node_id, AgentNode.agent_id == conn_data.agent_id)
    ).first()
    
    if not source_node or not target_node:
        raise HTTPException(status_code=404, detail="Source or target node not found")
    
    connection = AgentConnection(
        agent_id=conn_data.agent_id,
        source_node_id=conn_data.source_node_id,
        target_node_id=conn_data.target_node_id,
        condition=conn_data.condition,
        priority=conn_data.priority,
        label=conn_data.label
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)
    
    # Audit Log
    log_audit_event(
        db=db,
        action="create_connection",
        resource_type="connection",
        resource_id=str(connection.id),
        details={
            "agent_id": connection.agent_id, 
            "source": connection.source_node_id, 
            "target": connection.target_node_id
        },
        request=request
    )
    
    return {
        "id": connection.id,
        "source_node_id": connection.source_node_id,
        "target_node_id": connection.target_node_id,
        "condition": connection.condition,
        "label": connection.label
    }


@router.put("/connections/{connection_id}", response_model=Dict[str, Any])
async def update_connection(
    connection_id: int, 
    conn_data: ConnectionUpdate, 
    request: Request,
    db: Session = Depends(get_db)
):
    """Update a connection"""
    connection = db.query(AgentConnection).filter(AgentConnection.id == connection_id).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    update_data = conn_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(connection, key, value)
    
    db.commit()
    db.refresh(connection)
    
    # Audit Log
    log_audit_event(
        db=db,
        action="update_connection",
        resource_type="connection",
        resource_id=str(connection.id),
        details={"agent_id": connection.agent_id, "updated_fields": list(update_data.keys())},
        request=request
    )
    
    return {
        "id": connection.id,
        "source_node_id": connection.source_node_id,
        "target_node_id": connection.target_node_id,
        "condition": connection.condition,
        "label": connection.label
    }


@router.delete("/connections/{connection_id}")
async def delete_connection(
    connection_id: int, 
    request: Request,
    db: Session = Depends(get_db)
):
    """Delete a connection"""
    connection = db.query(AgentConnection).filter(AgentConnection.id == connection_id).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    agent_id = connection.agent_id
    
    db.delete(connection)
    db.commit()
    
    # Audit Log
    log_audit_event(
        db=db,
        action="delete_connection",
        resource_type="connection",
        resource_id=str(connection_id),
        details={"agent_id": agent_id},
        request=request
    )
    
    return {"message": "Connection deleted successfully"}


@router.post("/generate-flow", response_model=Dict[str, Any])
async def generate_flow(
    request: GenerateFlowRequest,
    db: Session = Depends(get_db)
):
    """Generate agent flow from prompt"""
    agent = db.query(Agent).filter(Agent.id == request.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    generator = FlowGenerator(db)
    result = await generator.generate_from_prompt(agent, request.prompt)
    
    return result


# Conversation/Execution endpoint
@router.post("/conversations")  # Return dict directly to ensure all fields are included
async def process_message(
    request: ConversationRequest, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Process a message through an agent"""
    agent = db.query(Agent).filter(Agent.id == request.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if not agent.is_active:
        raise HTTPException(status_code=400, detail="Agent is not active")
    
    # Get or create conversation
    session_id = request.session_id or str(uuid.uuid4())
    conversation = db.query(AgentConversation).filter(
        and_(
            AgentConversation.agent_id == request.agent_id,
            AgentConversation.session_id == session_id,
            AgentConversation.is_active == True
        )
    ).first()
    
    if not conversation:
        conversation = AgentConversation(
            agent_id=request.agent_id,
            session_id=session_id,
            channel=request.channel,
            context=request.context or {}
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    
    # Save user message
    user_message = AgentMessage(
        conversation_id=conversation.id,
        role="user",
        content=request.message
    )
    db.add(user_message)
    
    # Execute agent flow
    from app.services.agent_executor import AgentExecutor
    executor = AgentExecutor(db, background_tasks=background_tasks)
    
    # Force load nodes relationship and log agent state
    node_count = len(agent.nodes) if agent.nodes else 0
    logger.info(f"Agent {agent.id} ({agent.name}): entry_node_id={agent.entry_node_id}, is_active={agent.is_active}, node_count={node_count}")
    if node_count == 0:
        logger.warning(f"Agent {agent.id} has NO NODES configured!")
    if not agent.entry_node_id:
        logger.warning(f"Agent {agent.id} has NO ENTRY NODE set!")
    
    try:
        result = await executor.execute(agent, conversation, request.message)
        logger.info(f"Executor result keys: {list(result.keys())}")
        logger.info(f"Executor result has debug_trace: {'debug_trace' in result}")
        
        response_text = result.get("response", agent.fallback_message or "I'm processing your request...")
        debug_trace = result.get("debug_trace", [])
        
        # Log debug trace for debugging
        logger.info(f"Extracted debug_trace length: {len(debug_trace)}")
        logger.info(f"debug_trace type: {type(debug_trace)}")
        logger.info(f"debug_trace value: {debug_trace}")
        
        if debug_trace:
            logger.info(f"Debug trace steps: {[e.get('step') for e in debug_trace]}")
            logger.info(f"Debug trace types: {[e.get('node_type') for e in debug_trace]}")
        else:
            logger.warning("Debug trace is empty! Creating diagnostic entry.")
            # Create a minimal trace if empty
            debug_trace = [{
                "step": 1,
                "node_id": None,
                "node_type": "WARNING",
                "node_name": "No Trace Generated",
                "status": "warning",
                "message": f"Execution completed but no debug trace was generated. Agent entry_node_id: {agent.entry_node_id}, Result keys: {list(result.keys())}",
                "timestamp": datetime.utcnow().isoformat()
            }]
        
        # Update conversation with result
        conversation.current_node_id = result.get("node_id")
        conversation.context = result.get("context", conversation.context)
        conversation.execution_history = conversation.execution_history or []
        conversation.execution_history.append({
            "timestamp": datetime.utcnow().isoformat(),
            "node_id": result.get("node_id"),
            "metadata": result.get("metadata", {})
        })
        
        # Persist full debug trace
        if debug_trace:
            conversation.debug_trace = debug_trace
            
    except Exception as e:
        logger.error(f"Error executing agent: {str(e)}", exc_info=True)
        import traceback
        error_traceback = traceback.format_exc()
        response_text = agent.fallback_message or "I encountered an error. Please try again."
        debug_trace = [{
            "step": 1,
            "node_id": None,
            "node_type": "ERROR",
            "node_name": "Execution Error",
            "status": "error",
            "message": f"Error executing agent: {str(e)}",
            "error": str(e),
            "error_traceback": error_traceback,
            "timestamp": datetime.utcnow().isoformat()
        }]
        logger.error(f"Error traceback: {error_traceback}")
    
    # Save assistant response
    assistant_message = AgentMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=response_text
    )
    db.add(assistant_message)
    
    conversation.updated_at = datetime.utcnow()
    db.commit()
    
    # Ensure debug_trace is always included and is a list
    if 'debug_trace' not in locals() or debug_trace is None:
        logger.warning("debug_trace not in locals or is None, creating empty list")
        debug_trace = []
    if not isinstance(debug_trace, list):
        logger.warning(f"debug_trace is not a list (type: {type(debug_trace)}), converting to list")
        debug_trace = []
    
    # Build response as plain dict to ensure all fields are included
    response_dict = {
        "response": response_text,
        "session_id": session_id,
        "context": conversation.context or {},
        "node_id": result.get("node_id") if 'result' in locals() else None,
        "metadata": result.get("metadata") if 'result' in locals() else None,
        "debug_trace": debug_trace  # Always include, even if empty list
    }
    
    # CRITICAL: Double-check debug_trace is in the dict
    assert "debug_trace" in response_dict, "debug_trace MUST be in response_dict!"
    assert isinstance(response_dict["debug_trace"], list), "debug_trace MUST be a list!"
    
    logger.info(f"Returning response with debug_trace length: {len(debug_trace)}")
    logger.info(f"Response dict keys: {list(response_dict.keys())}")
    logger.info(f"debug_trace value: {debug_trace}")
    logger.info(f"debug_trace type: {type(debug_trace)}")
    
    # Verify debug_trace is in the dict before returning
    if "debug_trace" not in response_dict:
        logger.error("CRITICAL: debug_trace missing from response_dict! Adding it now.")
        response_dict["debug_trace"] = debug_trace if debug_trace else []
    
    # Use JSONResponse explicitly to ensure all fields are included
    return JSONResponse(content=response_dict)


@router.post("/generate-flow")
async def generate_flow_from_prompt(request: GenerateFlowRequest, db: Session = Depends(get_db)):
    """Generate agent flow from natural language prompt"""
    try:
        agent = db.query(Agent).filter(Agent.id == request.agent_id).first()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        if not request.prompt or not request.prompt.strip():
            raise HTTPException(status_code=400, detail="Prompt cannot be empty")
        
        generator = FlowGenerator(db)
        result = await generator.generate_from_prompt(agent, request.prompt.strip())
        
        if not result.get("success"):
            error_msg = result.get("error", "Failed to generate flow")
            logger.error(f"Flow generation failed: {error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in generate_flow_from_prompt: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/conversations/{session_id}")
async def get_conversation(session_id: str, db: Session = Depends(get_db)):
    """Get conversation history"""
    conversation = db.query(AgentConversation).filter(
        AgentConversation.session_id == session_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    messages = [
        {
            "id": msg.id,
            "role": msg.role,
            "content": msg.content,
            "created_at": msg.created_at.isoformat() if msg.created_at else None
        }
        for msg in conversation.messages
    ]
    
    return {
        "session_id": conversation.session_id,
        "agent_id": conversation.agent_id,
        "context": conversation.context,
        "messages": messages,
        "created_at": conversation.created_at.isoformat() if conversation.created_at else None
    }


@router.get("/conversations/{session_id}/trace")
async def get_conversation_trace(session_id: str, db: Session = Depends(get_db)):
    """Get full execution trace for a conversation"""
    conversation = db.query(AgentConversation).filter(
        AgentConversation.session_id == session_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    return {
        "session_id": session_id,
        "debug_trace": conversation.debug_trace or []
    }


# ============================================================================
# Agent Integration Endpoints
# ============================================================================

class AgentIntegrationCreate(BaseModel):
    master_agent_id: int
    sub_agent_id: int
    name: Optional[str] = None
    description: Optional[str] = None
    routing_condition: Optional[Dict[str, Any]] = None
    priority: Optional[int] = 0
    pass_context: Optional[bool] = True
    merge_response: Optional[bool] = True


@router.get("/{agent_id}/integrations")
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


@router.post("/integrations")
async def create_agent_integration(integration: AgentIntegrationCreate, db: Session = Depends(get_db)):
    """Create a new agent integration"""
    master_agent = db.query(Agent).filter(Agent.id == integration.master_agent_id).first()
    if not master_agent:
        raise HTTPException(status_code=404, detail="Master agent not found")
    
    sub_agent = db.query(Agent).filter(Agent.id == integration.sub_agent_id).first()
    if not sub_agent:
        raise HTTPException(status_code=404, detail="Sub-agent not found")
    
    existing = db.query(AgentIntegration).filter(
        AgentIntegration.master_agent_id == integration.master_agent_id,
        AgentIntegration.sub_agent_id == integration.sub_agent_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Integration already exists")
    
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


@router.delete("/integrations/{integration_id}")
async def delete_agent_integration(integration_id: int, db: Session = Depends(get_db)):
    """Delete an agent integration"""
    integration = db.query(AgentIntegration).filter(AgentIntegration.id == integration_id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    db.delete(integration)
    db.commit()
    
    return {"message": "Integration deleted successfully"}


@router.get("/{agent_id}/available-for-integration")
async def get_available_agents_for_integration(agent_id: int, db: Session = Depends(get_db)):
    """Get list of agents available for integration"""
    integrated_ids = db.query(AgentIntegration.sub_agent_id).filter(
        AgentIntegration.master_agent_id == agent_id
    ).all()
    integrated_ids = [id[0] for id in integrated_ids]
    
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

# ============================================================================
# Import/Export
# ============================================================================

@router.get("/{agent_id}/export")
async def export_agent(agent_id: int, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    nodes = db.query(AgentNode).filter(AgentNode.agent_id == agent_id).all()
    connections = db.query(AgentConnection).filter(AgentConnection.agent_id == agent_id).all()
    flows = db.query(AgentFlow).filter(AgentFlow.agent_id == agent_id).all()
    integrations = db.query(AgentIntegration).filter(AgentIntegration.master_agent_id == agent_id).all()
    import io, zipfile, json
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("agent.json", json.dumps({
            "id": agent.id,
            "name": agent.name,
            "description": agent.description,
            "agent_type": agent.agent_type.value if agent.agent_type else None,
            "system_prompt": agent.system_prompt,
            "welcome_message": agent.welcome_message,
            "fallback_message": agent.fallback_message,
            "settings": agent.settings,
            "tags": agent.tags,
            "entry_node_id": agent.entry_node_id,
            "version": agent.version,
            "is_active": agent.is_active,
            "is_public": agent.is_public
        }, ensure_ascii=False))
        z.writestr("nodes.json", json.dumps([
            {
                "id": n.id,
                "node_type": n.node_type.value if n.node_type else None,
                "name": n.name,
                "label": n.label,
                "config": n.config,
                "position_x": n.position_x,
                "position_y": n.position_y,
                "timeout": n.timeout,
                "retry_count": n.retry_count,
                "error_handling": n.error_handling,
                "description": n.description,
                "tags": n.tags
            } for n in nodes
        ], ensure_ascii=False))
        z.writestr("connections.json", json.dumps([
            {
                "id": c.id,
                "source_node_id": c.source_node_id,
                "target_node_id": c.target_node_id,
                "condition": c.condition,
                "priority": c.priority,
                "label": c.label
            } for c in connections
        ], ensure_ascii=False))
        z.writestr("flows.json", json.dumps([
            {
                "id": f.id,
                "name": f.name,
                "description": f.description,
                "flow_definition": f.flow_definition,
                "is_active": f.is_active,
                "is_default": f.is_default
            } for f in flows
        ], ensure_ascii=False))
        z.writestr("integrations.json", json.dumps([
            {
                "id": i.id,
                "sub_agent_id": i.sub_agent_id,
                "name": i.name,
                "description": i.description,
                "routing_condition": i.routing_condition,
                "priority": i.priority,
                "pass_context": i.pass_context,
                "merge_response": i.merge_response
            } for i in integrations
        ], ensure_ascii=False))
    buf.seek(0)
    headers = {"Content-Disposition": f'attachment; filename="agent_{agent_id}.zip"'}
    return StreamingResponse(buf, media_type="application/zip", headers=headers)

@router.post("/import")
async def import_agent(
    file: UploadFile = File(...),
    import_type: str = Form("full"),
    db: Session = Depends(get_db)
):
    import io, zipfile, json
    data = await file.read()
    try:
        with zipfile.ZipFile(io.BytesIO(data), "r") as z:
            agent_data = json.loads(z.read("agent.json").decode("utf-8"))
            nodes_data = json.loads(z.read("nodes.json").decode("utf-8")) if "nodes.json" in z.namelist() else []
            connections_data = json.loads(z.read("connections.json").decode("utf-8")) if "connections.json" in z.namelist() else []
            flows_data = json.loads(z.read("flows.json").decode("utf-8")) if "flows.json" in z.namelist() else []
            integrations_data = json.loads(z.read("integrations.json").decode("utf-8")) if "integrations.json" in z.namelist() else []
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid zip file")
    target_agent = None
    existing_id = agent_data.get("id")
    if import_type == "incremental" and existing_id:
        target_agent = db.query(Agent).filter(Agent.id == existing_id).first()
    if not target_agent:
        atype = agent_data.get("agent_type") or AgentType.CHATBOT.value
        try:
            atype_enum = AgentType(atype)
        except Exception:
            atype_enum = AgentType.CHATBOT
        target_agent = Agent(
            name=agent_data.get("name") or "Imported Agent",
            description=agent_data.get("description"),
            agent_type=atype_enum,
            system_prompt=agent_data.get("system_prompt"),
            welcome_message=agent_data.get("welcome_message"),
            fallback_message=agent_data.get("fallback_message"),
            settings=agent_data.get("settings"),
            tags=agent_data.get("tags"),
            is_active=bool(agent_data.get("is_active", True)),
            is_public=bool(agent_data.get("is_public", False)),
            version=agent_data.get("version") or "1.0.0"
        )
        db.add(target_agent)
        db.commit()
        db.refresh(target_agent)
    else:
        for k in ["name","description","system_prompt","welcome_message","fallback_message","settings","tags","version"]:
            v = agent_data.get(k)
            if v is not None:
                setattr(target_agent, k, v)
        db.commit()
        db.refresh(target_agent)
    node_id_map: Dict[int, int] = {}
    if import_type == "full":
        db.query(AgentConnection).filter(AgentConnection.agent_id == target_agent.id).delete()
        db.query(AgentNode).filter(AgentNode.agent_id == target_agent.id).delete()
        db.query(AgentFlow).filter(AgentFlow.agent_id == target_agent.id).delete()
        db.commit()
    for n in nodes_data:
        try:
            nt = n.get("node_type")
            nt_enum = NodeType(nt) if nt else NodeType.MESSAGE
        except Exception:
            nt_enum = NodeType.MESSAGE
        node = AgentNode(
            agent_id=target_agent.id,
            node_type=nt_enum,
            name=n.get("name") or f"Node-{uuid.uuid4().hex[:6]}",
            label=n.get("label"),
            config=n.get("config"),
            position_x=int(n.get("position_x") or 0),
            position_y=int(n.get("position_y") or 0),
            timeout=int(n.get("timeout") or 30),
            retry_count=int(n.get("retry_count") or 0),
            error_handling=n.get("error_handling"),
            description=n.get("description"),
            tags=n.get("tags")
        )
        db.add(node)
        db.flush()
        if "id" in n and isinstance(n["id"], int):
            node_id_map[n["id"]] = node.id
        if nt_enum == NodeType.START and not target_agent.entry_node_id:
            target_agent.entry_node_id = node.id
    db.commit()
    if import_type == "full":
        db.query(AgentConnection).filter(AgentConnection.agent_id == target_agent.id).delete()
        db.commit()
    for c in connections_data:
        src = c.get("source_node_id")
        tgt = c.get("target_node_id")
        src_id = node_id_map.get(src, src)
        tgt_id = node_id_map.get(tgt, tgt)
        conn = AgentConnection(
            agent_id=target_agent.id,
            source_node_id=src_id,
            target_node_id=tgt_id,
            condition=c.get("condition"),
            priority=int(c.get("priority") or 0),
            label=c.get("label")
        )
        db.add(conn)
    db.commit()
    for f in flows_data:
        flow = AgentFlow(
            agent_id=target_agent.id,
            name=f.get("name") or "Imported Flow",
            description=f.get("description"),
            flow_definition=f.get("flow_definition") or {},
            is_active=bool(f.get("is_active", True)),
            is_default=bool(f.get("is_default", False))
        )
        db.add(flow)
    db.commit()
    for i in integrations_data:
        sub_id = i.get("sub_agent_id")
        if sub_id:
            integ = AgentIntegration(
                master_agent_id=target_agent.id,
                sub_agent_id=sub_id,
                name=i.get("name"),
                description=i.get("description"),
                routing_condition=i.get("routing_condition"),
                priority=int(i.get("priority") or 0),
                pass_context=bool(i.get("pass_context", True)),
                merge_response=bool(i.get("merge_response", True))
            )
            db.add(integ)
    db.commit()
    return {"status": "success", "agent_id": target_agent.id}
