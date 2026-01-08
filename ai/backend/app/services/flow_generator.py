"""
Prompt-based Flow Generator
Analyzes user prompts and automatically generates agent flows with nodes and connections
"""
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.db.models.agent import Agent, AgentNode, AgentConnection, NodeType
from app.llm.registry import get_available_llm
import json
import logging
import re

logger = logging.getLogger(__name__)


class FlowGenerator:
    """Generates agent flows from natural language prompts"""
    
    def __init__(self, db: Session):
        self.db = db
        self.llm = get_available_llm()
    
    async def generate_from_prompt(
        self,
        agent: Agent,
        user_prompt: str
    ) -> Dict[str, Any]:
        """
        Generate agent flow from user prompt
        
        Args:
            agent: The agent to generate flow for
            user_prompt: Natural language description of what the agent should do
            
        Returns:
            Dict with nodes and connections created
        """
        try:
            # Create prompt for LLM to analyze
            analysis_prompt = f"""You are an expert at designing conversational AI agent flows. 
Analyze the following user requirement and design a complete agent flow.

User Requirement:
{user_prompt}

Agent Details:
- Name: {agent.name}
- Type: {agent.agent_type.value}
- Description: {agent.description or "N/A"}
- System Prompt: {agent.system_prompt or "N/A"}

Design a flow that includes:
1. A START node (entry point)
2. Appropriate processing nodes (LLM, Entity extraction, Intent detection, etc.)
3. Conditional logic if needed
4. Service/API integrations if mentioned
5. Response nodes
6. An END node

Return a JSON structure with:
{{
  "nodes": [
    {{
      "node_type": "start|llm|entity|intent|condition|api|service|connector|response|end",
      "name": "unique_node_name",
      "label": "Display Label",
      "config": {{}},
      "position_x": 0,
      "position_y": 0
    }}
  ],
  "connections": [
    {{
      "source": "source_node_name",
      "target": "target_node_name",
      "condition": {{}}
    }}
  ],
  "entry_node": "start_node_name"
}}

Make the flow logical and complete. Position nodes in a flow layout (left to right, top to bottom).
Start node at (100, 200), then space nodes 200px apart horizontally, 150px vertically for branches."""

            # Get LLM response
            response_text = ""
            async for token in self.llm.stream(analysis_prompt):
                response_text += token
            
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if not json_match:
                # Fallback: create a simple flow
                return await self._create_simple_flow(agent, user_prompt)
            
            flow_data = json.loads(json_match.group())
            
            # Create nodes and connections
            created_nodes = {}
            node_positions = {}
            
            # Create all nodes first
            for node_data in flow_data.get("nodes", []):
                node = AgentNode(
                    agent_id=agent.id,
                    node_type=NodeType(node_data.get("node_type", "llm")),
                    name=node_data.get("name", f"node_{len(created_nodes)}"),
                    label=node_data.get("label", node_data.get("name", "Node")),
                    config=node_data.get("config", {}),
                    position_x=node_data.get("position_x", 100),
                    position_y=node_data.get("position_y", 200),
                )
                self.db.add(node)
                self.db.flush()
                created_nodes[node_data.get("name")] = node
                node_positions[node_data.get("name")] = (node.id, node.position_x, node.position_y)
            
            # Set entry node
            entry_node_name = flow_data.get("entry_node")
            if entry_node_name and entry_node_name in created_nodes:
                agent.entry_node_id = created_nodes[entry_node_name].id
            
            # Create connections
            connections_created = []
            for conn_data in flow_data.get("connections", []):
                source_name = conn_data.get("source")
                target_name = conn_data.get("target")
                
                if source_name in created_nodes and target_name in created_nodes:
                    connection = AgentConnection(
                        agent_id=agent.id,
                        source_node_id=created_nodes[source_name].id,
                        target_node_id=created_nodes[target_name].id,
                        condition=conn_data.get("condition"),
                        priority=conn_data.get("priority", 0),
                        label=conn_data.get("label")
                    )
                    self.db.add(connection)
                    connections_created.append({
                        "source": source_name,
                        "target": target_name
                    })
            
            self.db.commit()
            
            return {
                "success": True,
                "nodes_created": len(created_nodes),
                "connections_created": len(connections_created),
                "nodes": [{"id": n.id, "name": n.name, "type": n.node_type.value} for n in created_nodes.values()],
                "connections": connections_created
            }
            
        except Exception as e:
            logger.error(f"Error generating flow from prompt: {str(e)}", exc_info=True)
            # Fallback to simple flow
            return await self._create_simple_flow(agent, user_prompt)
    
    async def _create_simple_flow(
        self,
        agent: Agent,
        user_prompt: str
    ) -> Dict[str, Any]:
        """Create a simple default flow when LLM generation fails"""
        try:
            # Create START node
            start_node = AgentNode(
                agent_id=agent.id,
                node_type=NodeType.START,
                name="start",
                label="Start",
                config={},
                position_x=100,
                position_y=200,
            )
            self.db.add(start_node)
            self.db.flush()
            
            # Create LLM node
            llm_node = AgentNode(
                agent_id=agent.id,
                node_type=NodeType.LLM,
                name="llm_processor",
                label="LLM Processor",
                config={
                    "prompt": agent.system_prompt or "You are a helpful assistant.",
                    "llm_provider": "openai",
                    "temperature": 0.7,
                    "max_tokens": 1000
                },
                position_x=300,
                position_y=200,
            )
            self.db.add(llm_node)
            self.db.flush()
            
            # Create RESPONSE node
            response_node = AgentNode(
                agent_id=agent.id,
                node_type=NodeType.RESPONSE,
                name="response",
                label="Response",
                config={
                    "response": "",
                    "response_type": "text"
                },
                position_x=500,
                position_y=200,
            )
            self.db.add(response_node)
            self.db.flush()
            
            # Create END node
            end_node = AgentNode(
                agent_id=agent.id,
                node_type=NodeType.END,
                name="end",
                label="End",
                config={},
                position_x=700,
                position_y=200,
            )
            self.db.add(end_node)
            self.db.flush()
            
            # Create connections
            conn1 = AgentConnection(
                agent_id=agent.id,
                source_node_id=start_node.id,
                target_node_id=llm_node.id,
                priority=0
            )
            self.db.add(conn1)
            
            conn2 = AgentConnection(
                agent_id=agent.id,
                source_node_id=llm_node.id,
                target_node_id=response_node.id,
                priority=0
            )
            self.db.add(conn2)
            
            conn3 = AgentConnection(
                agent_id=agent.id,
                source_node_id=response_node.id,
                target_node_id=end_node.id,
                priority=0
            )
            self.db.add(conn3)
            
            # Set entry node
            agent.entry_node_id = start_node.id
            
            self.db.commit()
            
            return {
                "success": True,
                "nodes_created": 4,
                "connections_created": 3,
                "nodes": [
                    {"id": start_node.id, "name": "start", "type": "start"},
                    {"id": llm_node.id, "name": "llm_processor", "type": "llm"},
                    {"id": response_node.id, "name": "response", "type": "response"},
                    {"id": end_node.id, "name": "end", "type": "end"}
                ],
                "connections": [
                    {"source": "start", "target": "llm_processor"},
                    {"source": "llm_processor", "target": "response"},
                    {"source": "response", "target": "end"}
                ]
            }
        except Exception as e:
            logger.error(f"Error creating simple flow: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }

