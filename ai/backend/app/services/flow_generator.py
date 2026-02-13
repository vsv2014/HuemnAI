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
            return NodeType.LLM
        if any(k in s or k in n or k in l for k in ["entity", "extract"]):
            return NodeType.DATA_ANALYSIS if hasattr(NodeType, "DATA_ANALYSIS") else NodeType.LLM
        if any(k in text for k in ["knowledge", "faq", "kb", "docs", "documentation"]):
            return NodeType.DATA_ANALYSIS
        if any(k in text for k in ["jira", "zendesk", "salesforce", "crm", "ticket"]):
            return NodeType.WORKFLOW_AUTOMATION if hasattr(NodeType, "WORKFLOW_AUTOMATION") else NodeType.ORCHESTRATOR
        if any(k in text for k in ["email", "gmail", "outlook"]):
            return NodeType.EMAIL_PROCESSOR if hasattr(NodeType, "EMAIL_PROCESSOR") else NodeType.NOTIFICATION
        if any(k in text for k in ["slack", "notification", "notify", "alert"]):
            return NodeType.NOTIFICATION
        if any(k in text for k in ["calendar", "schedule", "meeting"]):
            return NodeType.CALENDAR
        if any(k in text for k in ["ivr", "call", "phone", "twilio"]):
            return NodeType.IVR_CALL if hasattr(NodeType, "IVR_CALL") else NodeType.STREAMING
        if any(k in text for k in ["stream", "realtime"]):
            return NodeType.STREAMING
        if any(k in text for k in ["auth", "login", "verify"]):
            return NodeType.AUTH_PROVIDER if hasattr(NodeType, "AUTH_PROVIDER") else NodeType.SESSION_STATE
        if any(k in text for k in ["database", "db", "transaction", "sql"]):
            return NodeType.DB_TRANSACTION if hasattr(NodeType, "DB_TRANSACTION") else NodeType.DATA_PROCESSOR if hasattr(NodeType, "DATA_PROCESSOR") else NodeType.ORCHESTRATOR
        if any(k in text for k in ["scrape", "crawl"]):
            return NodeType.WEB_SCRAPER
        if any(k in s or k in n or k in l for k in ["response", "reply"]):
            return NodeType.RESPONSE
        return NodeType.LLM
    
    async def generate_from_prompt(
        self,
        agent: Agent,
        user_prompt: str
    ) -> Dict[str, Any]:
        """
        Generate agent flow from user prompt using Orchestrator
        """
        try:
            from app.orchestrator.planner.planner import build_plan
            from app.orchestrator.bot_engine.engine import FlowCompiler

            # Use the advanced Orchestrator to plan the flow
            plan = await build_plan(user_prompt)
            
            # Use the FlowCompiler to generate nodes and edges
            # The compiler uses a vertical layout by default
            compiled = FlowCompiler().compile(plan)
            
            nodes_spec = []
            for n in compiled.get("nodes", []):
                # Map orchestrator types to NodeType
                raw_type = n.get("type", "step")
                ntype_map = {
                    "entry": NodeType.START,
                    "end": NodeType.END,
                    "response": NodeType.RESPONSE,
                    "reasoning": NodeType.LLM,
                    "rag": NodeType.AI_RAG,
                    "workflow": NodeType.WORKFLOW_AUTOMATION,
                    "api": NodeType.API,
                    "calendar": NodeType.CALENDAR,
                    "analysis": NodeType.DATA_ANALYSIS,
                    "decision": NodeType.AI_DECISION,
                    "module": NodeType.SERVICE
                }
                ntype = ntype_map.get(raw_type, NodeType.LLM)
                
                nodes_spec.append({
                    "node_type": ntype.value,
                    "name": n.get("id"),
                    "label": n.get("label"),
                    "config": n.get("data", {}),
                    "position_x": n.get("x", 0),
                    "position_y": n.get("y", 0)
                })
            
            connections_spec = []
            for e in compiled.get("edges", []):
                connections_spec.append({
                    "source": e.get("source"),
                    "target": e.get("target"),
                    "condition": {}
                })
                
            flow_data = {
                "nodes": nodes_spec,
                "connections": connections_spec,
                "entry_node": next((n["name"] for n in nodes_spec if n["node_type"] == "start"), nodes_spec[0]["name"] if nodes_spec else None)
            }
            
            # Architect's Validation Step
            flow_data = self._validate_flow(flow_data)
            
            return await self._create_from_llm_json(agent, user_prompt, flow_data)
            
        except Exception as e:
            logger.error(f"Error generating flow via orchestrator: {str(e)}", exc_info=True)
            # Fallback to the original heuristic method if orchestrator fails
            return await self._create_heuristic_flow(agent, user_prompt)

    def _validate_flow(self, flow_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Senior Architect's Final Validation (Step 6):
        1. Does the flow directly achieve the goal?
        2. Is there unnecessary complexity? (Remove generic infrastructure)
        3. Are nodes minimal but sufficient?
        4. Is reasoning centralized but branches preserved?
        """
        nodes = flow_data.get("nodes", [])
        connections = flow_data.get("connections", [])
        
        # 0. Infrastructure Purge: Remove generic utility nodes, but KEEP intentional business routers
        # We only remove nodes that are generic 'infrastructure' and don't add business value
        generic_infrastructure = [
            "policy_router", "domain_router", "intent_detector", 
            "entity_extractor", "audit_log", "notification_gateway",
            "gateway", "logger"
        ]
        
        nodes_to_remove = []
        for n in nodes:
            name = n.get("name", "").lower()
            label = n.get("label", "").lower()
            # ONLY remove if it's in the generic list AND not specifically requested as a business router
            if any(k in name or k in label for k in generic_infrastructure):
                if n["node_type"] not in [NodeType.START.value, NodeType.END.value, NodeType.RESPONSE.value]:
                    # Exception: If it's labeled "Workflow Router" or similar, keep it as it's part of business logic
                    if "workflow" in label or "business" in label or "task" in label:
                        continue
                    nodes_to_remove.append(n["name"])
        
        if nodes_to_remove:
            logger.info(f"Architect (Step 6): Purging generic infrastructure: {nodes_to_remove}")
            nodes = [n for n in nodes if n["name"] not in nodes_to_remove]
            
            # Bypass logic
            for rid in nodes_to_remove:
                incoming = [c for c in connections if c["target"] == rid]
                outgoing = [c for c in connections if c["source"] == rid]
                for inc in incoming:
                    for out in outgoing:
                        if inc["source"] != out["target"]:
                            connections.append({
                                "source": inc["source"],
                                "target": out["target"],
                                "condition": inc.get("condition", {})
                            })
                connections = [c for c in connections if c["source"] != rid and c["target"] != rid]

        # 1. Branch Preservation: Ensure decision nodes have their branches intact
        # (We skip the aggressive LLM merge if there are multiple intentional branches)
        reasoning_nodes = [n for n in nodes if n["node_type"] == NodeType.LLM.value]
        
        # Only merge if they are effectively doing the same thing in a linear sequence
        # If they are in different branches or one is a manager and others are workers, keep them
        if len(reasoning_nodes) > 1:
            # Simple heuristic: if one node has multiple outgoing edges to other reasoning nodes, it's a manager
            # We only merge reasoning nodes that are redundant
            pass # For now, let's be less aggressive with merging to see if it improves the user's complex case

        # 2. Orphan Removal: Final sweep for disconnected nodes
        connected_sources = {c["source"] for c in connections}
        connected_targets = {c["target"] for c in connections}
        
        orphaned = []
        for n in nodes:
            if n["node_type"] in [NodeType.START.value, NodeType.END.value]: continue
            if n["name"] not in connected_sources and n["name"] not in connected_targets:
                orphaned.append(n["name"])
        
        if orphaned:
            logger.info(f"Architect (Step 6): Removing orphaned nodes: {orphaned}")
            nodes = [n for n in nodes if n["name"] not in orphaned]
            connections = [c for c in connections if c["source"] not in orphaned and c["target"] not in orphaned]

        return {
            "nodes": nodes,
            "connections": connections,
            "entry_node": flow_data.get("entry_node")
        }



    
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
            ordered = sorted(created_nodes, key=lambda n: (n.position_x or 0, n.position_y or 0))
            for i in range(len(ordered) - 1):
                a = ordered[i]; b = ordered[i + 1]
                if a.node_type == NodeType.END or b.node_type == NodeType.START:
                    continue
                if not has_edge(a, b):
                    link(a, b)
            if not has_edge(response_node, end_node):
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
            return await self._create_heuristic_flow(agent, user_prompt)
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
