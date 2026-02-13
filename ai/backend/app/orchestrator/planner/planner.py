import asyncio
import json
import re
from typing import Dict, Any, List, Optional
from app.llm.registry import get_available_llm
import hashlib


class NodeRegistry:
    """Registry of available nodes and their capabilities"""
    @staticmethod
    def get_nodes() -> List[Dict[str, Any]]:
        return [
            {"type": "entry", "capability": "entry_point", "label": "Start", "desc": "Start of the conversation"},
            {"type": "reasoning", "capability": "intent_analysis", "label": "AI Reasoning Core", "desc": "Analyze user intent and decide next steps"},
            {"type": "rag", "capability": "knowledge_retrieval", "label": "Knowledge Retrieval", "desc": "Search and retrieve facts from knowledge base"},
            {"type": "workflow", "capability": "automation", "label": "Workflow Automation", "desc": "Execute complex automated tasks (CRM, Inventory)"},
            {"type": "api", "capability": "integration", "label": "API Integration", "desc": "Call external APIs (Custom tools)"},
            {"type": "calendar", "capability": "scheduling", "label": "Appointment Scheduler", "desc": "Manage bookings and calendar events"},
            {"type": "analysis", "capability": "data_processing", "label": "Data Analysis", "desc": "Extract entities or process structured data"},
            {"type": "decision", "capability": "conditional_logic", "label": "Decision Logic", "desc": "Branch flow based on conditions"},
            {"type": "response", "capability": "user_communication", "label": "Response", "desc": "Send final message to user"},
            {"type": "end", "capability": "exit_point", "label": "End", "desc": "End of the conversation"}
        ]


class PromptParser:
    async def parse(self, prompt: str) -> Dict[str, Any]:
        """
        Step 1 & 2: Architect's Deep Analysis.
        Analyze prompt FIRST to extract goals, entities, and business actions.
        """
        llm = get_available_llm()
        system = (
            "You are a Senior AI Workflow Architect. Analyze the user's request using this 6-step process:\n"
            "1. Analyze prompt FIRST before thinking about nodes.\n"
            "2. Identify high-level business goals and required entities.\n"
            "3. Determine specific business actions (e.g., 'check_inventory', 'validate_candidate').\n"
            "4. Identify branching logic and decision points.\n"
            "5. Map these to the most efficient node structure (avoiding redundancy).\n"
            "6. Ensure the design is production-ready and goal-driven.\n\n"
            "Extract requirements in JSON format:\n"
            "{\n"
            "  \"primary_goal\": \"...\",\n"
            "  \"entities\": [\"...\"],\n"
            "  \"business_flows\": [\"...\"],\n"
            "  \"business_actions\": [\"...\"],\n"
            "  \"decision_logic\": \"...\",\n"
            "  \"integrations\": [\"...\"],\n"
            "  \"is_complex\": true/false,\n"
            "  \"designed_flow\": { \"nodes\": [...], \"edges\": [...] } // Optional: Direct node design for complex tasks\n"
            "}"
        )
        tokens = []
        msgs = [{"role": "system", "content": system}, {"role": "user", "content": prompt}]
        try:
            async for t in llm.stream(message=prompt, messages=msgs, model=None):
                tokens.append(t)
            
            text = "".join(tokens).strip()
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
                
            analysis = json.loads(text)
        except Exception:
            # High-quality fallback heuristic using regex for word boundaries
            p = prompt.lower()
            analysis = {
                "primary_goal": "Process user request",
                "business_flows": [],
                "business_actions": [],
                "decision_logic": "Route based on intent",
                "integrations": []
            }
            
            # Helper for whole-word matching
            def has_any(keywords):
                return any(re.search(rf"\b{k}\b", p) for k in keywords)

            # E-commerce / General Support
            if has_any(["order", "track", "tracking"]): analysis["business_flows"].append("order_tracking")
            if has_any(["refund", "return"]): analysis["business_flows"].append("refund_request")
            
            # Smart Payment Logic: Only add payment if it's NOT a recruitment/HR context
            is_hr_context = has_any(["candidate", "recruitment", "screening", "resume", "interview", "onboarding", "payroll"])
            if has_any(["payment", "transaction", "pay", "charge"]) and not has_any(["payroll"]) and not is_hr_context: 
                analysis["business_flows"].append("payment_issue")
            
            if has_any(["inventory", "stock"]): analysis["business_flows"].append("inventory_check")
            
            # IT Support / Automation (New)
            is_it_context = has_any(["it", "support", "technical", "helpdesk", "login", "password", "vpn", "software", "hardware", "laptop", "device", "access", "permission"])
            if has_any(["login", "password", "vpn", "access", "permission"]): analysis["business_flows"].append("access_management")
            if has_any(["install", "software", "application", "license"]): analysis["business_flows"].append("software_provisioning")
            if has_any(["hardware", "laptop", "device", "printer", "monitor"]): analysis["business_flows"].append("hardware_support")
            if has_any(["it_support", "helpdesk", "technical_issue"]): analysis["business_flows"].append("it_helpdesk")
            
            # Integrations for IT/Support
            if is_it_context:
                if has_any(["jira"]): analysis["integrations"].append("jira")
                if has_any(["zendesk"]): analysis["integrations"].append("zendesk")
                if has_any(["salesforce"]): analysis["integrations"].append("salesforce")
                if has_any(["slack"]): analysis["integrations"].append("slack")
                if has_any(["teams"]): analysis["integrations"].append("teams")
            
            # HR / Recruitment (New)
            if has_any(["candidate", "recruitment", "screening", "resume"]): analysis["business_flows"].append("candidate_screening")
            if has_any(["interview", "schedule", "calendar", "booking"]): analysis["business_flows"].append("interview_scheduling")
            if has_any(["onboarding", "new_hire", "welcome"]): analysis["business_flows"].append("employee_onboarding")
            
            # Disambiguate policy: only HR if not in IT context or explicitly HR
            if has_any(["hr_policy", "handbook"]) or (has_any(["policy"]) and has_any(["hr"]) and not is_it_context): 
                analysis["business_flows"].append("hr_policy_support")
            if has_any(["payroll", "salary", "benefits"]): analysis["business_flows"].append("payroll_and_benefits")
            
            # General
            if has_any(["human", "escalate", "agent", "support"]): analysis["business_flows"].append("human_escalation")
            if has_any(["knowledge", "faq", "docs", "documentation"]): analysis["business_flows"].append("knowledge_retrieval")
            
            # Ensure uniqueness and logical flow count
            analysis["business_flows"] = list(dict.fromkeys(analysis["business_flows"]))[:6]
        
        return {"raw": prompt, "analysis": analysis}


class TaskPlanner:
    async def plan(self, parsed: Dict[str, Any], intent: str) -> Dict[str, Any]:
        """
        Step 3-5: Goal -> Flow Mapping.
        Design a realistic, branched, and goal-driven flow.
        """
        analysis = parsed.get("analysis", {})
        
        # If the LLM already designed a flow, use it!
        if "designed_flow" in analysis and isinstance(analysis["designed_flow"], dict):
            df = analysis["designed_flow"]
            if df.get("nodes") and df.get("edges"):
                ctx = dict(parsed)
                ctx["designed_flow"] = df
                return {"intent": intent, "steps": [], "context": ctx}

        flows = analysis.get("business_flows", [])
        prompt_text = parsed.get("raw", "").lower()

        available_nodes = NodeRegistry.get_nodes()
        nodes = []
        edges = []
        
        # 1. Start
        nodes.append({
            "id": "start",
            "type": "entry",
            "label": "Start",
            "x": 400, "y": 50,
            "data": {"desc": "Entry point"}
        })
        
        # 2. Intent Classifier / Manager
        # This node will branch out to different flows
        nodes.append({
            "id": "manager",
            "type": "reasoning",
            "label": "Intent & Task Manager",
            "x": 400, "y": 180,
            "data": {"desc": "Classifies intent and routes to correct flow"}
        })
        edges.append({"id": "e_start_manager", "source": "start", "target": "manager"})
        
        # 3. Decision Logic - if we have multiple flows or HR/IT specific flows, we need a decision node
        is_hr_flow = any(f in ["candidate_screening", "interview_scheduling", "employee_onboarding", "hr_policy_support", "payroll_and_benefits"] for f in flows)
        is_it_flow = any(f in ["access_management", "software_provisioning", "hardware_support", "it_helpdesk"] for f in flows)
        
        if len(flows) > 1 or is_hr_flow or is_it_flow:
            decision_node = {
                "id": "router",
                "type": "decision",
                "label": "Workflow Router",
                "x": 400, "y": 300,
                "data": {"desc": "Directs traffic to specialized nodes"}
            }
            nodes.append(decision_node)
            edges.append({"id": "e_manager_router", "source": "manager", "target": "router"})
            branch_source = "router"
            flow_y = 450
        else:
            branch_source = "manager"
            flow_y = 300

        # 4. Specialized Flow Nodes (Branches)
        # We'll spread them horizontally
        branch_count = len(flows) if flows else 1
        start_x = 400 - (branch_count - 1) * 150
        
        branch_nodes = []
        
        if not flows:
            # Default single flow if none identified
            ntype = "rag" if "knowledge" in prompt_text else "reasoning"
            label = "General Processor"
            nid = "gen_proc"
            nodes.append({
                "id": nid, "type": ntype, "label": label,
                "x": 400, "y": flow_y,
                "data": {"desc": "Processes the general request"}
            })
            edges.append({"id": f"e_{branch_source}_{nid}", "source": branch_source, "target": nid})
            branch_nodes.append(nid)
        else:
            for i, flow in enumerate(flows):
                nid = f"flow_{flow}"
                # Map flow to best node type
                ntype = "workflow"
                label = flow.replace("_", " ").title()
                
                # E-commerce
                if "order" in flow: ntype = "workflow"
                elif "refund" in flow: ntype = "workflow"
                elif "payment" in flow: ntype = "api"
                elif "inventory" in flow: ntype = "analysis"
                
                # HR / Recruitment
                elif "candidate" in flow: ntype = "analysis"
                elif "interview" in flow: ntype = "calendar"
                elif "onboarding" in flow: ntype = "workflow"
                elif "policy" in flow: ntype = "rag"
                elif "payroll" in flow: ntype = "workflow"
                
                # IT Support / Automation
                elif "access" in flow: ntype = "api"
                elif "software" in flow: ntype = "workflow"
                elif "hardware" in flow: ntype = "workflow"
                elif "it_helpdesk" in flow: ntype = "workflow"
                
                # General
                elif "knowledge" in flow: ntype = "rag"
                elif "human" in flow: ntype = "workflow"
                
                nodes.append({
                    "id": nid, "type": ntype, "label": label,
                    "x": start_x + (i * 300), "y": flow_y,
                    "data": {"desc": f"Handles {label} tasks"}
                })
                edges.append({"id": f"e_{branch_source}_{nid}", "source": branch_source, "target": nid})
                branch_nodes.append(nid)

        # 5. Response Node (All branches merge here)
        resp_y = flow_y + 180
        nodes.append({
            "id": "response",
            "type": "response",
            "label": "Contextual Response",
            "x": 400, "y": resp_y,
            "data": {"desc": "Synthesizes result into user message"}
        })
        
        for bnid in branch_nodes:
            edges.append({"id": f"e_{bnid}_response", "source": bnid, "target": "response"})
            
        # 6. End
        nodes.append({
            "id": "end",
            "type": "end",
            "label": "End",
            "x": 400, "y": resp_y + 120,
            "data": {"desc": "Workflow complete"}
        })
        edges.append({"id": "e_response_end", "source": "response", "target": "end"})

        designed_flow = {"nodes": nodes, "edges": edges}
        ctx = dict(parsed)
        ctx["designed_flow"] = designed_flow
        
        return {"intent": intent, "steps": [], "context": ctx}





class IntentDetector:
    async def detect(self, prompt: str) -> str:
        """Detect the primary intent of the user prompt"""
        llm = get_available_llm()
        system = "You are an intent classifier. Detect the primary goal of the user prompt. Return a single word or short phrase (e.g., 'customer_support', 'data_analysis', 'automation')."
        tokens = []
        try:
            async for t in llm.stream(message=prompt, messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}]):
                tokens.append(t)
            return "".join(tokens).strip().lower()
        except Exception:
            return "general_task"


async def build_plan(prompt: str) -> Dict[str, Any]:
    parser = PromptParser()
    detector = IntentDetector()
    planner = TaskPlanner()
    parsed = await parser.parse(prompt)
    intent = await detector.detect(prompt)
    return await planner.plan(parsed, intent)

async def generate_followups(prompt: str):
    return [
        {"key": "primary_objective", "question": "What is the primary objective?", "example": "Launch automated ordering across outlets", "type": "text"},
        {"key": "constraints", "question": "List constraints", "example": "budget, compliance, time, staffing", "type": "text"},
        {"key": "deadline", "question": "What is the deadline?", "example": "2026-03-15", "type": "date"},
        {"key": "resources", "question": "Available resources", "example": "APIs, staff, tools, data", "type": "text"},
        {"key": "preferences", "question": "Preferences", "example": "channels, tech stack, UX style", "type": "text"},
        {"key": "risks", "question": "Known risks", "example": "integration failures, vendor delays", "type": "text"}
    ]

async def generate_tailored_followups(prompt: str, answers: Dict[str, Any]):
    llm = get_available_llm()
    sys = (
        "You are an industry analyst. Based on the business type and country, "
        "infer typical end-to-end flows needed to complete the described task. "
        "Return ONLY a compact JSON array of question objects: "
        "{key, question, example, type, options}. "
        "Use appropriate types (text|number|phone|select|boolean|multiselect|date|time). "
        "Focus on the NEXT flow steps the user must configure (e.g., menus, compliance, integrations, routing, payments, scheduling). "
        "Keep 6-10 items, specific to the business and country context."
    )
    user = {"prompt": prompt, "answers": answers}
    messages = [{"role": "system", "content": sys}, {"role": "user", "content": json.dumps(user, ensure_ascii=False)}]
    tokens: List[str] = []
    try:
        async for t in llm.stream(message=json.dumps(user, ensure_ascii=False), messages=messages, model=None):
            tokens.append(t)
        text = "".join(tokens).strip()
        data = json.loads(text)
        if isinstance(data, list) and all(isinstance(x, dict) for x in data):
            seen = set()
            cleaned = []
            for d in data:
                k = d.get("key") or f"q{len(cleaned)}"
                if k in seen:
                    k = f"{k}_{len(cleaned)}"
                seen.add(k)
                cleaned.append({
                    "key": k,
                    "question": d.get("question") or "Provide details",
                    "example": d.get("example") or "",
                    "type": (d.get("type") or "text").lower(),
                    "options": d.get("options") if isinstance(d.get("options"), list) else None
                })
            return cleaned[:12]
    except Exception:
        pass
    bt = str(answers.get("business_type") or "").lower()
    if bt == "restaurant":
        return [
            {"key": "has_reservations", "question": "Support table reservations?", "example": "Yes", "type": "boolean"},
            {"key": "menu_sections", "question": "Menu sections?", "example": "Starters, Mains, Desserts", "type": "text"},
            {"key": "delivery_partners", "question": "Delivery partners?", "example": "Swiggy, Zomato", "type": "multiselect", "options": ["Swiggy","Zomato","UberEats","DoorDash"]},
            {"key": "payment_methods", "question": "Payment methods to enable", "example": "UPI, Card", "type": "multiselect", "options": ["UPI","Card","Wallet","NetBanking"]},
            {"key": "gst_vat_required", "question": "GST/VAT compliance required?", "example": "Yes", "type": "boolean"}
        ]
    return [
        {"key": "key_integrations", "question": "Key integrations needed?", "example": "CRM, payment gateway", "type": "text"},
        {"key": "ops_workflow", "question": "Outline operations workflow steps", "example": "intake → validation → execution → notification", "type": "text"},
        {"key": "compliance", "question": "Compliance requirements", "example": "GDPR, PCI-DSS", "type": "text"},
        {"key": "channels", "question": "Customer channels to support", "example": "web, WhatsApp", "type": "multiselect", "options": ["web","whatsapp","voice","email","sms"]},
    ]

def extract_initial_answers(prompt: str) -> Dict[str, Any]:
    p = (prompt or "").strip().lower()
    out: Dict[str, Any] = {}
    # Usecase: prefer the full prompt as description if it contains verbs or known phrases
    if len(p.split()) >= 4:
        out["usecase_description"] = prompt.strip()
    # Business detection by keywords
    biz_map = [
        ("restaurant", ["biryani", "restaurant", "menu", "order", "food", "chef", "waiter", "kitchen", "dine", "outlet"]),
        ("retail", ["retail", "shop", "store", "inventory", "pos", "billing", "counter"]),
        ("ecommerce", ["ecommerce", "cart", "checkout", "online store", "shopify", "woocommerce"]),
        ("healthcare", ["clinic", "doctor", "hospital", "patient", "appointment", "medical"]),
        ("finance", ["bank", "loan", "finance", "payment", "upi", "card", "gateway"]),
        ("travel", ["travel", "hotel", "booking", "flight", "tour", "trip"]),
        ("education", ["school", "college", "university", "student", "course", "class"]),
        ("logistics", ["logistics", "warehouse", "delivery", "dispatch", "fleet", "courier"]),
    ]
    for label, keys in biz_map:
        if any(k in p for k in keys):
            out["business_type"] = label
            break
    # Country detection by simple lookup
    countries = ["india","united states","usa","us","united kingdom","uk","canada","australia","germany","france","singapore","uae","united arab emirates","qatar","saudi","japan","china","brazil","mexico","south africa"]
    for c in countries:
        if c in p:
            if c in ["usa","us"]:
                out["country"] = "United States"
            elif c in ["uk","united kingdom"]:
                out["country"] = "United Kingdom"
            elif c in ["uae","united arab emirates"]:
                out["country"] = "UAE"
            else:
                out["country"] = c.title()
            break
    return out

async def generate_plan_summary(prompt: str, answers: Dict[str, Any]) -> str:
    llm = get_available_llm()
    sys = (
        "You are a planning agent. Perform online-style research based on public knowledge and produce a concrete plan. "
        "Return a concise, actionable plan with: objectives, constraints, timeline, recommended providers/tools, step-by-step actions, "
        "cost ranges, and booking/execution steps. If the usecase is travel, produce an itinerary with transport options, "
        "lodging suggestions by area, local constraints, and a day-wise schedule aligned to the deadline. "
        "Avoid asking generic follow-up questions; only ask if a critical detail is missing."
    )
    user = {"prompt": prompt, "answers": answers}
    messages = [{"role": "system", "content": sys}, {"role": "user", "content": json.dumps(user, ensure_ascii=False)}]
    tokens: List[str] = []
    try:
        async for t in llm.stream(message=json.dumps(user, ensure_ascii=False), messages=messages, model=None):
            tokens.append(t)
        text = "".join(tokens).strip()
        if len(text) > 20:
            return text
    except Exception:
        pass
    bt = str(answers.get("business_type") or "").lower()
    country = str(answers.get("country") or "")
    deadline = str(answers.get("deadline") or "")
    usecase = str(answers.get("usecase_description") or prompt or "")
    if "travel" in bt or "trip" in usecase.lower() or "travel" in usecase.lower():
        return f"- Objective: {usecase}\n- Country/City: {country or 'Mumbai'}\n- Date: {deadline or 'TBD'}\n- Transport: Compare major carriers; pick morning inbound, evening return.\n- Stay: South Mumbai or Bandra (safe, connected). Budget vs. mid options.\n- Day 1: Arrival, check-in, evening local sights.\n- Day 2: Core attractions, guided tour optional.\n- Day 3: Markets and coastal walk, depart.\n- Booking: Flights, hotel, local transport; keep buffers.\n- Constraints: Budget, schedule, seasonal events.\n- Next: Confirm budget and preferences to finalize bookings."
    return f"- Objective: {usecase}\n- Country: {country or 'N/A'}\n- Timeline: {deadline or 'TBD'}\n- Steps: Research, shortlist providers, integrate tools, execute, verify.\n- Providers: Based on region; finalize after budget.\n- Next: Confirm budget and channels to proceed."
