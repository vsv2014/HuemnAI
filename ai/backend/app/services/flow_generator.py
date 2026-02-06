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

            # Verify LLM configuration to avoid silent fallback
            try:
                from app.services.config_service import get_llm_config
                cfg = get_llm_config()
                llm_configured = bool(cfg and cfg.get("api_key"))
            except Exception:
                llm_configured = False

            # If LLM is not configured, return deterministic minimal flow
            if not llm_configured:
                return await self._create_simple_flow(agent, user_prompt)

            # Prepare strict messaging to force JSON-only output
            system = "You are a flow designer. Return ONLY valid JSON that matches the requested schema. No prose. No code fences."
            messages = [
                {"role": "system", "content": system + "\n" + analysis_prompt},
                {"role": "user", "content": user_prompt}
            ]

            # Stream response
            response_text = ""
            async for token in self.llm.stream(message=user_prompt, messages=messages, model=None):
                response_text += token

            # Robust JSON extraction: prefer fenced blocks, then balanced braces
            flow_data = None
            fence = re.search(r'```json\s*([\s\S]*?)```', response_text, re.IGNORECASE)
            if fence:
                try:
                    flow_data = json.loads(fence.group(1))
                except Exception:
                    flow_data = None
            if flow_data is None:
                brace = re.search(r'\{[\s\S]*\}', response_text)
                if brace:
                    try:
                        flow_data = json.loads(brace.group(0))
                    except Exception:
                        flow_data = None

            # If still no JSON, perform a second, stricter pass
            if flow_data is None:
                strict_messages = [
                    {"role": "system", "content": "Return ONLY valid compact JSON. No explanations. Use the exact schema."},
                    {"role": "user", "content": analysis_prompt}
                ]
                second_text = ""
                async for token in self.llm.stream(message=analysis_prompt, messages=strict_messages, model=None):
                    second_text += token
                brace2 = re.search(r'\{[\s\S]*\}', second_text)
                if brace2:
                    try:
                        flow_data = json.loads(brace2.group(0))
                    except Exception:
                        flow_data = None

            # If LLM still failed, build heuristic flow from the prompt
            if flow_data is None:
                return await self._create_heuristic_flow(agent, user_prompt)
            
            return await self._create_from_llm_json(agent, user_prompt, flow_data)
            
        except Exception as e:
            logger.error(f"Error generating flow from prompt: {str(e)}", exc_info=True)
            # Fallback to simple flow
            return await self._create_simple_flow(agent, user_prompt)
    
    async def _create_heuristic_flow(
        self,
        agent: Agent,
        user_prompt: str
    ) -> Dict[str, Any]:
        """Create a richer, domain-aware flow using heuristic analysis of the prompt and available agents."""
        try:
            text = user_prompt.lower()
            nodes: List[AgentNode] = []
            conns: List[AgentConnection] = []

            # Baseline canonical pipeline
            start = AgentNode(agent_id=agent.id, node_type=NodeType.START, name="start", label="Start", config={}, position_x=100, position_y=200)
            self.db.add(start); self.db.flush(); nodes.append(start)
            x = 300; y = 200

            # Intent and entities
            intent = AgentNode(agent_id=agent.id, node_type=NodeType.LLM, name="intent_detector", label="Intent Detector", config={"task": "classify_intent"}, position_x=x, position_y=y)
            self.db.add(intent); self.db.flush(); nodes.append(intent); x += 200

            entities = AgentNode(agent_id=agent.id, node_type=NodeType.DATA_ANALYSIS if hasattr(NodeType, "DATA_ANALYSIS") else NodeType.LLM, name="entity_extractor", label="Entity Extractor", config={"task": "extract_entities"}, position_x=x, position_y=y)
            self.db.add(entities); self.db.flush(); nodes.append(entities); x += 200

            # Security & authentication pipeline (added if security/fraud mentioned)
            security_required = any(k in text for k in [
                "security", "fraud", "otp", "kyc", "authentication", "mfa", "risk", "device fingerprint"
            ])
            sec_chain_last = entities
            if security_required:
                mfa = AgentNode(agent_id=agent.id, node_type=NodeType.AUTH_PROVIDER if hasattr(NodeType, "AUTH_PROVIDER") else NodeType.SESSION_STATE, name="mfa_auth", label="Multi-Factor Auth", config={"methods": ["otp", "device_fingerprint"]}, position_x=x, position_y=y-100)
                self.db.add(mfa); self.db.flush(); nodes.append(mfa)
                risk = AgentNode(agent_id=agent.id, node_type=NodeType.AI_INSIGHT if hasattr(NodeType, "AI_INSIGHT") else NodeType.DATA_ANALYSIS, name="risk_scoring", label="Risk Scoring", config={"model": "risk_score_v1"}, position_x=x, position_y=y+100)
                self.db.add(risk); self.db.flush(); nodes.append(risk)
                # Connect entities -> mfa and entities -> risk, then to policy_router
                def link(a: AgentNode, b: AgentNode):
                    c = AgentConnection(agent_id=agent.id, source_node_id=a.id, target_node_id=b.id, priority=0)
                    self.db.add(c); conns.append(c)
                link(entities, mfa)
                link(entities, risk)
                sec_chain_last = risk

            # Policy router to decide branch
            policy = AgentNode(agent_id=agent.id, node_type=NodeType.ORCHESTRATOR, name="policy_router", label="Policy Router", config={"rules": ["security_checks", "domain_routing"]}, position_x=x, position_y=y)
            self.db.add(policy); self.db.flush(); nodes.append(policy); x += 200

            # Connect previous chain to policy router
            c0 = AgentConnection(agent_id=agent.id, source_node_id=sec_chain_last.id, target_node_id=policy.id, priority=0)
            self.db.add(c0); conns.append(c0)

            # Domain router and domain-specific nodes
            domain_router = AgentNode(agent_id=agent.id, node_type=NodeType.ORCHESTRATOR, name="domain_router", label="Domain Router", config={"domains": []}, position_x=x, position_y=y)
            self.db.add(domain_router); self.db.flush(); nodes.append(domain_router); x += 200
            c1 = AgentConnection(agent_id=agent.id, source_node_id=policy.id, target_node_id=domain_router.id, priority=0)
            self.db.add(c1); conns.append(c1)

            # Determine domains from prompt
            want_account = any(k in text for k in ["account", "balance", "statement", "interest"])
            want_card = any(k in text for k in ["card", "pin", "dispute", "block", "unblock", "replacement"])
            want_payments = any(k in text for k in ["upi", "neft", "rtgs", "refund", "payment", "failed transaction"])
            want_loans = any(k in text for k in ["loan", "emi", "eligibility", "credit"])
            want_fraud = any(k in text for k in ["fraud", "suspicious", "lockdown", "otp", "identity"])
            want_profile = any(k in text for k in ["kyc", "address", "nominee", "profile"])
            want_advisory = any(k in text for k in ["advisory", "savings", "investment", "credit score"])
            want_complaint = any(k in text for k in ["complaint", "ticket", "sla", "escalation"])
            want_email = any(k in text for k in ["email", "gmail", "outlook"])
            want_calendar = any(k in text for k in ["calendar", "meeting", "schedule"])
            want_webscrape = any(k in text for k in ["scrape", "crawl"])

            # Create domain nodes (grid layout)
            dom_y = y - 150
            dom_x = x
            domain_nodes: List[AgentNode] = []
            def add_domain(name: str, label: str, ntype: NodeType, cfg: Dict[str, Any]):
                nonlocal dom_x, dom_y
                node = AgentNode(agent_id=agent.id, node_type=ntype, name=name, label=label, config=cfg, position_x=dom_x, position_y=dom_y)
                self.db.add(node); self.db.flush(); domain_nodes.append(node); nodes.append(node)
                # connect from router
                cc = AgentConnection(agent_id=agent.id, source_node_id=domain_router.id, target_node_id=node.id, priority=0)
                self.db.add(cc); conns.append(cc)
                dom_y += 150
                if dom_y > y + 300:
                    dom_y = y - 150
                    dom_x += 200
                return node

            if want_account:
                add_domain("account_services", "Account Services", NodeType.WORKFLOW_AUTOMATION, {"systems": ["CBS"]})
            if want_card:
                add_domain("card_services", "Card Services", NodeType.WORKFLOW_AUTOMATION, {"systems": ["CBS"]})
            if want_payments:
                add_domain("payments", "Payments", NodeType.WORKFLOW_AUTOMATION, {"systems": ["PaymentGateway"]})
            if want_loans:
                add_domain("loans_credit", "Loans & Credit", NodeType.WORKFLOW_AUTOMATION, {"systems": ["CRM", "CBS"]})
            if want_fraud:
                add_domain("fraud_security", "Fraud & Security", NodeType.AI_INSIGHT if hasattr(NodeType, "AI_INSIGHT") else NodeType.DATA_ANALYSIS, {"systems": ["FraudEngine"]})
            if want_profile:
                add_domain("customer_profile", "Customer Profile", NodeType.WORKFLOW_AUTOMATION, {"systems": ["KYCSystem", "CRM"]})
            if want_advisory:
                add_domain("advisory", "Advisory", NodeType.AI_INSIGHT if hasattr(NodeType, "AI_INSIGHT") else NodeType.DATA_ANALYSIS, {"systems": ["AnalyticsEngine"]})
            if want_complaint:
                add_domain("complaint_mgmt", "Complaint Management", NodeType.WORKFLOW_AUTOMATION, {"systems": ["Ticketing"]})
            if want_email:
                add_domain("email_ops", "Email AI", NodeType.EMAIL_PROCESSOR, {"systems": ["EmailService"]})
            if want_calendar:
                add_domain("calendar_ops", "Calendar", NodeType.CALENDAR, {"systems": ["CalendarService"]})
            if want_webscrape:
                add_domain("web_scrape", "Web Scraper", NodeType.WEB_SCRAPER, {"systems": []})

            # If none explicitly detected, include core trio to avoid under-building
            if not domain_nodes:
                add_domain("account_services", "Account Services", NodeType.WORKFLOW_AUTOMATION, {"systems": ["CBS"]})
                add_domain("payments", "Payments", NodeType.WORKFLOW_AUTOMATION, {"systems": ["PaymentGateway"]})
                add_domain("complaint_mgmt", "Complaint Management", NodeType.WORKFLOW_AUTOMATION, {"systems": ["Ticketing"]})

            # Agent composition: detect references to existing agents and add delegate nodes
            try:
                existing_agents = self.db.query(Agent).filter(Agent.is_active == True).all()
                delegate_nodes: List[AgentNode] = []
                for a in existing_agents:
                    name_lower = (a.name or "").lower()
                    if not name_lower:
                        continue
                    if name_lower in text or any(kw in text for kw in ["use existing bot", "reuse bot", "child bot", "parent bot", "delegate to"]):
                        dnode = AgentNode(
                            agent_id=agent.id,
                            node_type=NodeType.AGENT_DELEGATE,
                            name=f"delegate_{a.id}",
                            label=f"Delegate: {a.name}",
                            config={"agent_id": a.id, "pass_context": True, "merge_response": True},
                            position_x=dom_x,
                            position_y=y + 250
                        )
                        self.db.add(dnode); self.db.flush()
                        delegate_nodes.append(dnode); nodes.append(dnode)
                        # connect from domain router to delegate node
                        cc = AgentConnection(agent_id=agent.id, source_node_id=domain_router.id, target_node_id=dnode.id, priority=0)
                        self.db.add(cc); conns.append(cc)
                # keep delegate_nodes for wiring below
            except Exception as e:
                logger.warning(f"Agent delegate setup failed: {e}")

            # Add audit logging and notification nodes
            audit = AgentNode(agent_id=agent.id, node_type=NodeType.WORKFLOW_AUTOMATION, name="audit_log", label="Audit Log", config={"compliance": ["PCI-DSS", "GDPR", "RBI"]}, position_x=dom_x + 200, position_y=y)
            self.db.add(audit); self.db.flush(); nodes.append(audit)
            notify = AgentNode(agent_id=agent.id, node_type=NodeType.NOTIFICATION, name="notification", label="Notification", config={"channels": ["slack", "email"]}, position_x=dom_x + 400, position_y=y)
            self.db.add(notify); self.db.flush(); nodes.append(notify)

            # Optional handoff
            need_handoff = any(k in text for k in ["handoff", "human", "escalation"])
            handoff = None
            if need_handoff or want_complaint:
                handoff = AgentNode(agent_id=agent.id, node_type=NodeType.HANDOFF, name="handoff", label="Handoff", config={"threshold": 0.85}, position_x=dom_x + 600, position_y=y)
                self.db.add(handoff); self.db.flush(); nodes.append(handoff)

            # Response and End
            resp = AgentNode(agent_id=agent.id, node_type=NodeType.RESPONSE, name="response", label="Response", config={"response_type": "text"}, position_x=dom_x + 800, position_y=y)
            self.db.add(resp); self.db.flush(); nodes.append(resp)
            end = AgentNode(agent_id=agent.id, node_type=NodeType.END, name="end", label="End", config={}, position_x=dom_x + 1000, position_y=y)
            self.db.add(end); self.db.flush(); nodes.append(end)

            # Connections
            def link(a: AgentNode, b: AgentNode):
                c = AgentConnection(agent_id=agent.id, source_node_id=a.id, target_node_id=b.id, priority=0)
                self.db.add(c); conns.append(c)
            link(start, intent)
            link(intent, entities)
            # Connect each domain to audit -> notification -> optional handoff -> response
            for dn in domain_nodes:
                link(dn, audit)
                link(audit, notify)
                if handoff:
                    link(notify, handoff)
                    link(handoff, resp)
                else:
                    link(notify, resp)
            # Wire any delegate nodes through audit/notify to response
            try:
                for dnode in [n for n in nodes if n.node_type == NodeType.AGENT_DELEGATE]:
                    link(dnode, audit)
                    link(audit, notify)
                    if handoff:
                        link(notify, handoff)
                        link(handoff, resp)
                    else:
                        link(notify, resp)
            except Exception as e:
                logger.warning(f"Wiring delegate nodes failed: {e}")
            link(resp, end)

            agent.entry_node_id = start.id
            self.db.commit()

            return {
                "success": True,
                "nodes_created": len(nodes),
                "connections_created": len(conns),
                "nodes": [{"id": n.id, "name": n.name, "type": n.node_type.value} for n in nodes],
                "connections": [
                    {"source": "start", "target": "intent_detector"},
                    {"source": "intent_detector", "target": "entity_extractor"},
                    {"source": "response", "target": "end"}
                ]
            }
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
