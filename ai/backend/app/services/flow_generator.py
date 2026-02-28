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
    """Generates agent flows from natural language prompts using a multi-stage architecture engine"""
    
    def __init__(self, db: Session):
        self.db = db
        self.llm = get_available_llm()

    async def generate_from_prompt(
        self,
        agent: Agent,
        user_prompt: str
    ) -> Dict[str, Any]:
        """Main entry point for multi-stage architect engine"""
        try:
            # Stage 1: Deep Decomposition & Capability Identification
            decomposition = await self._decompose_use_case(user_prompt)
            domain = decomposition.get("domain", "general")
            capabilities = decomposition.get("capabilities", [])
            integrations = decomposition.get("integrations", [])

            # Stage 2: Capability-to-Node Mapping (Deterministic)
            node_mappings = self._map_capabilities_to_nodes(
                capabilities,
                integrations,
                domain,
                decomposition
            )

            # Stage 3: Dependency Resolution (Internal)
            dependencies = self._resolve_dependencies(node_mappings)
            missing_configs = dependencies.get("missing_configurations", [])

            # Stage 4: Graph Design (Topology)
            topology = await self._design_topology(user_prompt, decomposition, node_mappings)

            flow_data = {
                "nodes": topology.get("nodes", []),
                "connections": topology.get("connections", []),
                "entry_node": topology.get("entry_node", "start"),
                "missing_configurations": missing_configs
            }

            # Stage 5: Structural Validation
            flow_data = self._validate_flow_structure(flow_data)

            # Database Persistence
            result = await self._create_from_llm_json(agent, user_prompt, flow_data)
            
            # Debug: Check created nodes
            logger.info(f"Architect: Created {result.get('nodes_created')} nodes and {result.get('connections_created')} connections.")
            
            # Ensure missing configurations are returned to the frontend
            if missing_configs:
                result["missing_configurations"] = missing_configs
                
            return result
            
        except Exception as e:
            logger.error(f"Architect: Error in multi-stage generation: {str(e)}", exc_info=True)
            # CRITICAL: We want to see why it failed, not just silently fallback
            raise e

    async def _decompose_use_case(self, user_prompt: str) -> Dict[str, Any]:
        prompt = f"""
        As a Senior Enterprise AI Architect, deeply analyze and decompose the following user requirement into atomic functional requirements and capabilities.
        
        USER REQUIREMENT: "{user_prompt}"
        
        STRICT OUTPUT FORMAT (JSON):
        {{
            "domain": "website_bot" | "internal_enterprise" | "hybrid",
            "capabilities": ["capability1", "capability2", ...],
            "functional_requirements": ["req1", "req2", ...],
            "integrations": ["jira", "zendesk", "salesforce", "slack", "database", "api", ...],
            "complexity": "low" | "medium" | "high",
            "requires_branching": true | false,
            "requires_auth": true | false,
            "requires_sentiment_handoff": true | false,
            "requires_rag": true | false,
            "requires_multi_agent": true | false,
            "session_state_required": true | false
        }}
        
        CRITICAL: 
        1. Do NOT oversimplify. If the user prompt implies multiple steps, integrations, or decisions, reflect that in 'capabilities' and 'functional_requirements'.
        2. Do NOT use generic templates. ONLY identify capabilities that are DIRECTLY requested or NECESSARY for the specific task described in the prompt: "{user_prompt}".
        3. AVOID adding Authentication, Session State, or Sentiment Analysis unless the user prompt explicitly implies they are needed.
        4. SPECIFIC LOGIC: Identify any branching conditions (if/then) or parallel tasks mentioned.
        
        CAPABILITIES TO IDENTIFY:
        - knowledge_lookup (AI_RAG)
        - intent_detection (INTENT)
        - entity_extraction (ENTITY)
        - sentiment_analysis (AI_INSIGHT)
        - human_handoff (HANDOFF_INTELLIGENCE)
        - authentication (AUTH_PROVIDER)
        - session_state (SESSION_STATE)
        - external_api_call (API)
        - workflow_automation (WORKFLOW_AUTOMATION)
        - scheduling (CALENDAR)
        - notification (NOTIFICATION)
        - document_processing (DOCUMENT_PROCESSOR)
        - multi_agent_orchestration (AI_MULTI_AGENT)
        - decision_making (AI_DECISION)
        - logic_branching (CONDITION)
        - reasoning (LLM)
        """
        
        response = await self.llm.generate(prompt, temperature=0.2, max_tokens=2000)
        try:
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            return {"domain": "general", "capabilities": ["reasoning"]}
        except Exception as e:
            logger.error(f"Architect: Decomposition error: {e}")
            return {"domain": "general", "capabilities": ["reasoning"]}

    def _map_capabilities_to_nodes(self, capabilities: List[str], integrations: List[str], domain: str, decomposition: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Deterministic mapping of capabilities to available NodeTypes without generic templates"""
        mapping_table = {
            "knowledge_lookup": NodeType.AI_RAG,
            "intent_detection": NodeType.INTENT,
            "entity_extraction": NodeType.ENTITY,
            "sentiment_analysis": NodeType.AI_INSIGHT,
            "human_handoff": NodeType.HANDOFF_INTELLIGENCE,
            "authentication": NodeType.AUTH_PROVIDER,
            "session_state": NodeType.SESSION_STATE,
            "external_api_call": NodeType.API,
            "workflow_automation": NodeType.WORKFLOW_AUTOMATION,
            "scheduling": NodeType.CALENDAR,
            "notification": NodeType.NOTIFICATION,
            "document_processing": NodeType.DOCUMENT_PROCESSOR,
            "multi_agent_orchestration": NodeType.AI_MULTI_AGENT,
            "decision_making": NodeType.AI_DECISION,
            "logic_branching": NodeType.CONDITION,
            "reasoning": NodeType.LLM
        }
        
        nodes = []
        nodes.append({"id": "start", "type": NodeType.START, "label": "Start"})
        
        # 1. ONLY add nodes that were explicitly identified in decomposition
        caps = list(dict.fromkeys(capabilities or []))
        for cap in caps:
            if cap in mapping_table:
                nodes.append({
                    "id": f"node_{cap}",
                    "type": mapping_table[cap],
                    "label": cap.replace("_", " ").title()
                })
        
        # 2. Add Integration Nodes if requested
        for integration in integrations:
            nodes.append({
                "id": f"conn_{integration}",
                "type": NodeType.CONNECTOR,
                "label": f"{integration.title()} Connector",
                "integration": integration
            })
            
        # 3. Handle Domain-Specific Mandatory Nodes (Minimal)
        if domain == "website_bot":
            if not any(n["type"] == NodeType.PERSONA_CONTROL for n in nodes):
                nodes.append({"id": "persona", "type": NodeType.PERSONA_CONTROL, "label": "Agent Persona"})
        
        # 4. ALWAYS include these core structural nodes
        if not any(n["type"] == NodeType.RESPONSE for n in nodes):
            nodes.append({"id": "response", "type": NodeType.RESPONSE, "label": "Agent Response"})
        if not any(n["type"] == NodeType.END for n in nodes):
            nodes.append({"id": "end", "type": NodeType.END, "label": "End"})
        
        return nodes

    def _resolve_dependencies(self, nodes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Detect missing configuration fields for nodes that require external credentials"""
        missing_configs = []
        
        integration_fields = {
            "jira": ["base_url", "api_key", "project_key", "email"],
            "zendesk": ["subdomain", "api_token", "email"],
            "salesforce": ["instance_url", "client_id", "client_secret", "username", "password"],
            "slack": ["bot_token", "channel_id"],
            "database": ["connection_string", "table_name", "db_type"],
            "twilio": ["account_sid", "auth_token", "phone_number"],
            "hubspot": ["access_token", "portal_id"],
            "servicenow": ["instance_url", "username", "password"],
            "elevenlabs": ["api_key", "voice_id"],
            "openai": ["api_key", "model_name"]
        }
        
        for node in nodes:
            # Check for generic Connector nodes
            if node["type"] == NodeType.CONNECTOR and "integration" in node:
                integration = node["integration"].lower()
                if integration in integration_fields:
                    missing_configs.append({
                        "node": node["id"],
                        "label": node["label"],
                        "required_fields": integration_fields[integration]
                    })
                else:
                    # Fallback for unknown integrations
                    missing_configs.append({
                        "node": node["id"],
                        "label": node["label"],
                        "required_fields": ["api_key", "base_url"]
                    })
            
            # Check for explicit node types that require config
            if node["type"] == NodeType.API:
                missing_configs.append({
                    "node": node["id"],
                    "label": node["label"],
                    "required_fields": ["endpoint_url", "method", "headers", "body_template"]
                })
            
            if node["type"] == NodeType.AUTH_PROVIDER:
                 missing_configs.append({
                    "node": node["id"],
                    "label": node["label"],
                    "required_fields": ["auth_type", "client_id", "client_secret", "discovery_url"]
                })
            
            if node["type"] == NodeType.DATABASE:
                missing_configs.append({
                    "node": node["id"],
                    "label": node["label"],
                    "required_fields": ["connection_string", "query_template"]
                })

            if node["type"] == NodeType.AI_RAG:
                missing_configs.append({
                    "node": node["id"],
                    "label": node["label"],
                    "required_fields": ["knowledge_base_id", "search_threshold"]
                })
                
        return {"missing_configurations": missing_configs}

    async def _design_topology(self, user_prompt: str, decomposition: Dict[str, Any], mapped_nodes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Use LLM to design an optimal, branch-preserving graph topology using only the mapped nodes"""
        node_list_str = "\n".join([f"- {n['id']} ({n['type'].value}): {n['label']}" for n in mapped_nodes])
        functional_reqs = decomposition.get("functional_requirements", [])
        
        prompt = f"""
        As a Senior Enterprise AI Architect, design the optimal graph topology for an AI Agent.
        
        USER PROMPT: "{user_prompt}"
        FUNCTIONAL REQUIREMENTS: {json.dumps(functional_reqs)}
        AVAILABLE NODES (You MUST use these IDs):
        {node_list_str}
        
        ARCHITECTURAL CONSTRAINTS:
        1. GRAPH FLOW: Always Start -> ... -> End.
        2. BRANCHING: Use CONDITION nodes for logic gates. Do NOT collapse parallel paths.
        3. ROLES: 
           - LLM = Reasoning/Processing core only.
           - RESPONSE = Output to user only.
           - CONDITION = Branching logic only.
           - SERVICE/CONNECTOR = External interactions.
        4. CUSTOMIZATION: Do NOT follow a fixed template. Create the topology based on the specific user prompt and functional requirements.
        5. LABELS: Use specific, descriptive labels for nodes (e.g., "Check Refund Eligibility" instead of "Condition") that match the functional requirements.
        6. MULTI-AGENT: If 'orchestrator' node exists, it should manage sub-tasks in parallel or sequence.
        7. ERROR HANDLING: Create fallback paths for API or Auth failures if requested.
        8. REDUNDANCY: Avoid redundant LLM stacking.
        
        CRITICAL: Do NOT generate a simple linear flow (Start -> LLM -> Response -> End) unless the use case is extremely trivial.
        If multiple capabilities are identified, use them in the graph.
        
        STRICT OUTPUT FORMAT (JSON):
        {{
            "description": "Optimized description of the agent based on prompt",
            "system_prompt": "Highly optimized system prompt for the Reasoning Core",
            "nodes": [
                {{
                    "name": "node_id",
                    "node_type": "node_type_value",
                    "label": "Display Label",
                    "config": {{
                        "prompt": "Custom prompt/instruction for this node",
                        "system_prompt": "Custom system instruction for this node (if LLM)",
                        "model": "gpt-4o" | "gpt-3.5-turbo",
                        "temperature": float
                    }},
                    "position_x": integer,
                    "position_y": integer
                }}
            ],
            "connections": [
                {{
                    "source": "source_node_id",
                    "target": "target_node_id",
                    "condition": {{ "label": "optional branch label", "value": "optional condition" }}
                }}
            ],
            "entry_node": "start"
        }}
        """
        
        response = await self.llm.generate(prompt, temperature=0.3, max_tokens=3000)
        try:
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                # Basic structure check
                if data.get("nodes") and "connections" in data:
                    return data
        except Exception as e:
            logger.error(f"Architect: Topology design error: {e}")
        return self._fallback_topology(mapped_nodes, decomposition, user_prompt)

    def _fallback_topology(self, mapped_nodes: List[Dict[str, Any]], decomposition: Dict[str, Any], user_prompt: str) -> Dict[str, Any]:
        domain = decomposition.get("domain", "general")
        required = {n["id"]: n for n in mapped_nodes}
        nodes = []
        used = set()

        def add_node(node_id: str, node_type: NodeType, label: str, x: int, y: int, config: Optional[Dict[str, Any]] = None):
            if node_id in used:
                return
            used.add(node_id)
            nodes.append({
                "name": node_id,
                "node_type": node_type.value,
                "label": label,
                "config": config or {},
                "position_x": x,
                "position_y": y
            })

        seed = sum(ord(c) for c in (user_prompt or "")) % 60
        base_y = 200 + seed
        step_x = 180

        add_node("start", NodeType.START, "Start", 60, base_y)

        pre_order = []
        for key in ["persona", "auth", "session_state", "intent", "node_intent_detection"]:
            if key in required:
                pre_order.append(required[key])

        action_order = []
        for n in mapped_nodes:
            if n["id"] in ["start", "persona", "auth", "session_state", "intent", "node_intent_detection"]:
                continue
            if n["type"] in [NodeType.RESPONSE, NodeType.END]:
                continue
            if n["id"] == "sentiment" or n["type"] == NodeType.AI_INSIGHT:
                continue
            if n["id"] == "handoff" or n["type"] == NodeType.HANDOFF_INTELLIGENCE:
                continue
            action_order.append(n)

        post_sentiment = next((n for n in mapped_nodes if n["id"] == "sentiment" or n["type"] == NodeType.AI_INSIGHT), None)
        post_handoff = next((n for n in mapped_nodes if n["id"] == "handoff" or n["type"] == NodeType.HANDOFF_INTELLIGENCE), None)

        x = 60 + step_x
        for n in pre_order:
            add_node(n["id"], n["type"], n["label"], x, base_y)
            x += step_x

        condition_node = next((n for n in mapped_nodes if n["type"] == NodeType.CONDITION), None)
        if condition_node:
            add_node(condition_node["id"], condition_node["type"], condition_node["label"], x, base_y)
            x += step_x

        branch_y = base_y - 140
        for idx, n in enumerate(action_order):
            add_node(n["id"], n["type"], n["label"], x, branch_y + (idx * 140))
        x += step_x

        add_node("response", NodeType.RESPONSE, "Response", x, base_y, {"response_type": "text"})
        x += step_x

        if post_sentiment:
            add_node(post_sentiment["id"], post_sentiment["type"], post_sentiment["label"], x, base_y)
            x += step_x
        if post_handoff:
            add_node(post_handoff["id"], post_handoff["type"], post_handoff["label"], x, base_y)
            x += step_x

        add_node("end", NodeType.END, "End", x, base_y)

        connections = []
        def connect(a: str, b: str, condition: Optional[Dict[str, Any]] = None):
            connections.append({"source": a, "target": b, "condition": condition or {}})

        last = "start"
        for n in pre_order:
            connect(last, n["id"])
            last = n["id"]

        if condition_node:
            connect(last, condition_node["id"])
            for idx, n in enumerate(action_order):
                connect(condition_node["id"], n["id"], {"branch": f"path_{idx + 1}"})
            if action_order:
                for n in action_order:
                    connect(n["id"], "response")
            else:
                connect(condition_node["id"], "response")
        else:
            if action_order:
                for n in action_order:
                    connect(last, n["id"])
                    last = n["id"]
                connect(last, "response")
            else:
                connect(last, "response")

        if post_sentiment:
            connect("response", post_sentiment["id"])
            last = post_sentiment["id"]
        else:
            last = "response"

        if post_handoff:
            connect(last, post_handoff["id"], {"sentiment": "negative"})
            connect(post_handoff["id"], "end")
        else:
            connect(last, "end")

        if domain == "website_bot" and not action_order:
            connect("response", "end")

        return {
            "nodes": nodes,
            "connections": connections,
            "entry_node": "start"
        }

    def _validate_flow_structure(self, flow_data: Dict[str, Any]) -> Dict[str, Any]:
        """Final structural validation to ensure graph integrity without aggressive simplification"""
        nodes = flow_data.get("nodes", [])
        connections = flow_data.get("connections", [])
        
        if not nodes:
            return flow_data
            
        node_names = {n["name"] for n in nodes}
        node_types = {n["node_type"] for n in nodes}
        
        # Ensure Start node exists
        if "start" not in node_types and "start" not in node_names:
            nodes.insert(0, {
                "name": "start",
                "node_type": NodeType.START.value,
                "label": "Start",
                "position_x": 50,
                "position_y": 250
            })
            
        # Ensure End node exists
        if "end" not in node_types and "end" not in node_names:
            nodes.append({
                "name": "end",
                "node_type": NodeType.END.value,
                "label": "End",
                "position_x": 1400,
                "position_y": 250
            })

        # Ensure at least one Response node exists for user interaction
        if "response" not in node_types and "response" not in node_names:
            nodes.append({
                "name": "response",
                "node_type": NodeType.RESPONSE.value,
                "label": "Agent Response",
                "position_x": 1200,
                "position_y": 250,
                "config": {"response_type": "text"}
            })
            
        connected_sources = {c["source"] for c in connections}
        connected_targets = {c["target"] for c in connections}
        
        # CRITICAL: Do NOT purge 'reasoning' or 'infrastructure' nodes aggressively.
        # Only remove nodes that are truly disconnected (no source and no target).
        safe_types = [NodeType.START.value, NodeType.END.value, NodeType.RESPONSE.value]
        
        # Determine truly orphaned nodes
        orphaned = []
        for n in nodes:
            if n["node_type"] in safe_types: 
                continue
            if n["name"] not in connected_sources and n["name"] not in connected_targets:
                orphaned.append(n["name"])
        
        if orphaned:
            logger.info(f"Architect: Removing truly disconnected nodes: {orphaned}")
            nodes = [n for n in nodes if n["name"] not in orphaned]

        # Automatic connection logic for disconnected segments (Linear Fallback)
        if not connections and len(nodes) > 1:
            ordered = sorted(nodes, key=lambda n: (n.get("position_x", 0), n.get("position_y", 0)))
            for i in range(len(ordered) - 1):
                # Don't connect from End or to Start
                if ordered[i]["node_type"] == NodeType.END.value: continue
                if ordered[i + 1]["node_type"] == NodeType.START.value: continue
                connections.append({
                    "source": ordered[i]["name"], 
                    "target": ordered[i + 1]["name"], 
                    "condition": {}
                })

        flow_data["nodes"] = nodes
        flow_data["connections"] = connections
        return flow_data

    def _resolve_node_type(self, node_type_str: str, name: str, label: str, prompt_text: str):
        s = (node_type_str or "").lower()
        n = (name or "").lower()
        l = (label or "").lower()
        text = (prompt_text or "").lower()
        try:
            return NodeType(node_type_str)
        except Exception:
            pass
        if any(k in s or k in n or k in l for k in ["start", "entry"]):
            return NodeType.START
        if any(k in s or k in n or k in l for k in ["end", "finish"]):
            return NodeType.END
        if any(k in s or k in n or k in l for k in ["intent", "classifier"]):
            return NodeType.INTENT
        if any(k in s or k in n or k in l for k in ["entity", "extract"]):
            return NodeType.ENTITY
        if any(k in text for k in ["knowledge", "faq", "kb", "docs", "documentation"]):
            return NodeType.AI_RAG
        if any(k in text for k in ["jira", "zendesk", "salesforce", "crm", "ticket"]):
            return NodeType.CONNECTOR
        if any(k in text for k in ["email", "gmail", "outlook"]):
            return NodeType.EMAIL_PROCESSOR
        if any(k in text for k in ["slack", "notification", "notify", "alert"]):
            return NodeType.NOTIFICATION
        if any(k in text for k in ["calendar", "schedule", "meeting"]):
            return NodeType.CALENDAR
        if any(k in text for k in ["ivr", "call", "phone", "twilio"]):
            return NodeType.IVR_CALL if hasattr(NodeType, "IVR_CALL") else NodeType.STREAMING
        if any(k in text for k in ["stream", "realtime"]):
            return NodeType.STREAMING
        if any(k in text for k in ["auth", "login", "verify"]):
            return NodeType.AUTH_PROVIDER
        if any(k in text for k in ["database", "db", "transaction", "sql"]):
            return NodeType.DATABASE if hasattr(NodeType, "DATABASE") else NodeType.DB_TRANSACTION
        if any(k in text for k in ["scrape", "crawl"]):
            return NodeType.WEB_SCRAPER
        if any(k in s or k in n or k in l for k in ["response", "reply"]):
            return NodeType.RESPONSE
        if any(k in text for k in ["handoff", "escalation", "agent"]):
            return NodeType.HANDOFF_INTELLIGENCE
        if any(k in text for k in ["sentiment", "emotion", "satisfaction"]):
            return NodeType.AI_INSIGHT
        return NodeType.LLM



    
    async def _create_heuristic_flow(
        self,
        agent: Agent,
        user_prompt: str
    ) -> Dict[str, Any]:
        """Create a minimal, task-oriented flow as a fallback."""
        try:
            text = user_prompt.lower()
            nodes: List[AgentNode] = []
            conns: List[AgentConnection] = []

            # 1. Start Node
            start = AgentNode(agent_id=agent.id, node_type=NodeType.START, name="start", label="Start", config={}, position_x=100, position_y=250)
            self.db.add(start); self.db.flush(); nodes.append(start)
            last_node = start
            x = 300; y = 250

            # 2. Main Task Node (Reasoning/LLM)
            # If prompt mentions specific tasks, we add nodes for them
            has_knowledge = any(k in text for k in ["kb", "knowledge", "faq", "info", "docs"])
            has_scheduling = any(k in text for k in ["appointment", "schedule", "booking", "calendar"])
            has_api = any(k in text for k in ["crm", "api", "pay", "charge", "invoice", "sync"])

            if has_knowledge or has_scheduling or has_api or len(text.split()) > 10:
                # Add a reasoning core if it's not a trivial prompt
                reasoning = AgentNode(agent_id=agent.id, node_type=NodeType.LLM, name="reasoning", label="AI Reasoning Core", config={"task": "analyze_and_respond"}, position_x=x, position_y=y)
                self.db.add(reasoning); self.db.flush(); nodes.append(reasoning)
                c = AgentConnection(agent_id=agent.id, source_node_id=last_node.id, target_node_id=reasoning.id, priority=0)
                self.db.add(c); conns.append(c)
                last_node = reasoning
                x += 220

            # 3. Specific Capability Nodes
            if has_knowledge:
                rag = AgentNode(agent_id=agent.id, node_type=NodeType.AI_RAG if hasattr(NodeType, "AI_RAG") else NodeType.LLM, name="knowledge_base", label="Knowledge Base", config={}, position_x=x, position_y=y)
                self.db.add(rag); self.db.flush(); nodes.append(rag)
                c = AgentConnection(agent_id=agent.id, source_node_id=last_node.id, target_node_id=rag.id, priority=0)
                self.db.add(c); conns.append(c)
                last_node = rag
                x += 220

            if has_scheduling:
                cal = AgentNode(agent_id=agent.id, node_type=NodeType.CALENDAR, name="scheduler", label="Appointment Scheduler", config={}, position_x=x, position_y=y)
                self.db.add(cal); self.db.flush(); nodes.append(cal)
                c = AgentConnection(agent_id=agent.id, source_node_id=last_node.id, target_node_id=cal.id, priority=0)
                self.db.add(c); conns.append(c)
                last_node = cal
                x += 220

            if has_api:
                workflow = AgentNode(agent_id=agent.id, node_type=NodeType.WORKFLOW_AUTOMATION, name="workflow", label="Workflow Automation", config={}, position_x=x, position_y=y)
                self.db.add(workflow); self.db.flush(); nodes.append(workflow)
                c = AgentConnection(agent_id=agent.id, source_node_id=last_node.id, target_node_id=workflow.id, priority=0)
                self.db.add(c); conns.append(c)
                last_node = workflow
                x += 220

            # 4. Response and End
            resp = AgentNode(agent_id=agent.id, node_type=NodeType.RESPONSE, name="response", label="Response", config={"response_type": "text"}, position_x=x, position_y=y)
            self.db.add(resp); self.db.flush(); nodes.append(resp)
            c = AgentConnection(agent_id=agent.id, source_node_id=last_node.id, target_node_id=resp.id, priority=0)
            self.db.add(c); conns.append(c)
            
            end = AgentNode(agent_id=agent.id, node_type=NodeType.END, name="end", label="End", config={}, position_x=x+220, position_y=y)
            self.db.add(end); self.db.flush(); nodes.append(end)
            c = AgentConnection(agent_id=agent.id, source_node_id=resp.id, target_node_id=end.id, priority=0)
            self.db.add(c); conns.append(c)

            agent.entry_node_id = start.id
            self.db.commit()

            return {
                "success": True,
                "nodes_created": len(nodes),
                "connections_created": len(conns),
                "nodes": [{"id": n.id, "name": n.name, "type": n.node_type.value} for n in nodes],
                "connections": [{"source": c.source_node_id, "target": c.target_node_id} for c in conns]
            }
        except Exception as e:
            logger.error(f"Error creating heuristic flow: {str(e)}", exc_info=True)
            return await self._create_simple_flow(agent, user_prompt)
        except Exception as e:
            logger.error(f"Error creating heuristic flow: {str(e)}", exc_info=True)
            return await self._create_simple_flow(agent, user_prompt)

    async def _create_from_llm_json(
        self,
        agent: Agent,
        user_prompt: str,
        flow_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        try:
            text = (user_prompt or "").lower()
            
            # Update Agent properties if generated
            if flow_data.get("system_prompt"):
                agent.system_prompt = flow_data["system_prompt"]
            if flow_data.get("description"):
                agent.description = flow_data["description"]
            
            nodes_spec: List[Dict[str, Any]] = flow_data.get("nodes") or []
            conns_spec: List[Dict[str, Any]] = flow_data.get("connections") or []
            entry_name: Optional[str] = flow_data.get("entry_node")
            created_map: Dict[str, AgentNode] = {}
            created_nodes: List[AgentNode] = []
            created_conns: List[AgentConnection] = []
            def slug(s: str) -> str:
                s = (s or "").strip().lower()
                s = re.sub(r"[^a-z0-9]+", "_", s)
                s = re.sub(r"_+", "_", s).strip("_")
                return s
            used_names = set()
            for spec in nodes_spec:
                raw_type = str(spec.get("node_type") or "")
                raw_name = str(spec.get("name") or "")
                raw_label = str(spec.get("label") or raw_name or raw_type)
                cfg = spec.get("config") or {}
                px = int(spec.get("position_x") or 0)
                py = int(spec.get("position_y") or 0)
                ntype = self._resolve_node_type(raw_type, raw_name, raw_label, text)
                # Prefer a meaningful base_name; never default to generic 'node'
                base_name = slug(raw_name)
                if not base_name:
                    base_name = slug(raw_label)
                if not base_name:
                    base_name = ntype.value
                if ntype in [NodeType.START, NodeType.END, NodeType.RESPONSE]:
                    base_name = ntype.value
                name = base_name
                idx = 2
                while name in used_names:
                    name = f"{base_name}_{idx}"
                    idx += 1
                used_names.add(name)
                # Ensure visible labels are set for canonical nodes
                label = raw_label or ( "Start" if ntype == NodeType.START else "End" if ntype == NodeType.END else "Response" if ntype == NodeType.RESPONSE else name )
                node = AgentNode(agent_id=agent.id, node_type=ntype, name=name, label=label, config=cfg, position_x=px, position_y=py)
                self.db.add(node); self.db.flush()
                created_map[raw_name or raw_label or name] = node
                created_nodes.append(node)
            def link(a: AgentNode, b: AgentNode):
                c = AgentConnection(agent_id=agent.id, source_node_id=a.id, target_node_id=b.id, priority=0)
                self.db.add(c); created_conns.append(c)
            for cs in conns_spec:
                sname = str(cs.get("source") or "")
                tname = str(cs.get("target") or "")
                sn = created_map.get(sname)
                tn = created_map.get(tname)
                if sn and tn:
                    link(sn, tn)
            start_node = next((n for n in created_nodes if n.node_type == NodeType.START), None)
            end_node = next((n for n in created_nodes if n.node_type == NodeType.END), None)
            response_node = next((n for n in created_nodes if n.node_type == NodeType.RESPONSE), None)
            if start_node is None:
                start_node = AgentNode(agent_id=agent.id, node_type=NodeType.START, name="start", label="Start", config={}, position_x=100, position_y=200)
                self.db.add(start_node); self.db.flush(); created_nodes.insert(0, start_node); created_map["start"] = start_node
            if end_node is None:
                lx = max([n.position_x or 0 for n in created_nodes]) + 200 if created_nodes else 900
                ly = created_nodes[0].position_y if created_nodes else 200
                end_node = AgentNode(agent_id=agent.id, node_type=NodeType.END, name="end", label="End", config={}, position_x=lx, position_y=ly)
                self.db.add(end_node); self.db.flush(); created_nodes.append(end_node); created_map["end"] = end_node
            if response_node is None:
                lx = max([n.position_x or 0 for n in created_nodes]) + 100
                ly = created_nodes[0].position_y if created_nodes else 200
                response_node = AgentNode(agent_id=agent.id, node_type=NodeType.RESPONSE, name="response", label="Response", config={"response_type": "text"}, position_x=lx, position_y=ly)
                self.db.add(response_node); self.db.flush(); created_nodes.append(response_node); created_map["response"] = response_node
            def has_edge(src: AgentNode, tgt: AgentNode) -> bool:
                for c in created_conns:
                    if c.source_node_id == src.id and c.target_node_id == tgt.id:
                        return True
                return False
            # ONLY auto-connect if the node is truly orphaned (no outgoing edges) 
            # and it's not an END node, and there are no connections at all.
            # Otherwise, we trust the LLM's graph topology.
            if not created_conns:
                ordered = sorted(created_nodes, key=lambda n: (n.position_x or 0, n.position_y or 0))
                for i in range(len(ordered) - 1):
                    a = ordered[i]; b = ordered[i + 1]
                    if a.node_type == NodeType.END or b.node_type == NodeType.START:
                        continue
                    link(a, b)
            
            if response_node and end_node and not has_edge(response_node, end_node):
                link(response_node, end_node)
            if entry_name and created_map.get(entry_name):
                agent.entry_node_id = created_map[entry_name].id
            else:
                agent.entry_node_id = start_node.id
            self.db.commit()
            return {
                "success": True,
                "nodes_created": len(created_nodes),
                "connections_created": len(created_conns),
                "nodes": [{"id": n.id, "name": n.name, "type": n.node_type.value} for n in created_nodes],
                "connections": [{"source": ordered[[nn.id for nn in ordered].index(c.source_node_id)].name, "target": ordered[[nn.id for nn in ordered].index(c.target_node_id)].name} for c in created_conns]
            }
        except Exception as e:
            logger.error(f"Error creating flow from LLM JSON: {str(e)}", exc_info=True)
            raise e
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
