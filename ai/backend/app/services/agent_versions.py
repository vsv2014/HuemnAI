"""Immutable, JSON-safe snapshots for agent graph release candidates.

This captures the editor graph and agent configuration at a point in time.
It is not itself a deployment: runtime must be changed to resolve version-pinned
snapshots before environment promotion or rollback can be offered.
"""
from copy import deepcopy
import re
from typing import Dict, Any
from sqlalchemy.orm import Session
from app.db.models.agent import Agent, AgentNode, AgentConnection
from app.services.graph_validation import validate_graph


_SECRET_KEYS = frozenset({
    "api_key", "access_token", "refresh_token", "private_key",
    "password", "client_secret", "authorization", "credentials",
    "bearer_token", "secret_key", "webhook_secret", "token",
    "service_account_key", "access_key", "signing_key",
})


def safe_snapshot(value: Any) -> Any:
    """Omit literal credentials from immutable release records.

    References to a separately managed secret remain available; actual
    credentials must be resolved by the authenticated runtime at execution.
    """
    if isinstance(value, dict):
        return {
            key: "[REDACTED]" if re.sub(r"(?<!^)(?=[A-Z])", "_", str(key)).lower().replace("-", "_") in _SECRET_KEYS
            else safe_snapshot(child)
            for key, child in value.items()
        }
    if isinstance(value, list):
        return [safe_snapshot(child) for child in value]
    return deepcopy(value)


def snapshot_agent(db: Session, agent: Agent) -> Dict[str, Any]:
    nodes = db.query(AgentNode).filter(
        AgentNode.agent_id == agent.id
    ).order_by(AgentNode.id.asc()).all()
    connections = db.query(AgentConnection).filter(
        AgentConnection.agent_id == agent.id
    ).order_by(AgentConnection.id.asc()).all()
    graph = validate_graph(
        [node.id for node in nodes],
        [(edge.source_node_id, edge.target_node_id) for edge in connections],
        agent.entry_node_id,
    )
    if not graph["valid"]:
        raise ValueError("Cannot snapshot invalid agent graph: " + str(graph["errors"]))

    return {
        "schema_version": 1,
        "agent": {
            "id": agent.id,
            "name": agent.name,
            "description": agent.description,
            "agent_type": agent.agent_type.value if agent.agent_type else None,
            "system_prompt": agent.system_prompt,
            "welcome_message": agent.welcome_message,
            "fallback_message": agent.fallback_message,
            "settings": safe_snapshot(agent.settings or {}),
            "entry_node_id": agent.entry_node_id,
        },
        "nodes": [
            {
                "id": node.id,
                "type": node.node_type.value,
                "name": node.name,
                "label": node.label,
                "config": safe_snapshot(node.config or {}),
                "position": {"x": node.position_x, "y": node.position_y},
                "timeout": node.timeout,
                "retry_count": node.retry_count,
                "error_handling": safe_snapshot(node.error_handling or {}),
            }
            for node in nodes
        ],
        "connections": [
            {
                "id": edge.id,
                "source": edge.source_node_id,
                "target": edge.target_node_id,
                "condition": safe_snapshot(edge.condition or {}),
                "priority": edge.priority,
                "label": edge.label,
            }
            for edge in connections
        ],
    }


def same_revision(snapshot: Dict[str, Any], current: Dict[str, Any]) -> bool:
    """Publishing an obsolete draft must fail, not silently ship a different graph."""
    return isinstance(snapshot, dict) and snapshot == current
