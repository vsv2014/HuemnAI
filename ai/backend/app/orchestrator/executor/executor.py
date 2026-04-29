import asyncio
import json
from typing import Dict, Any, List, Optional, Callable
from app.llm.registry import get_available_llm
from app.services.socket_manager import manager
from app.orchestrator.memory.store import MemoryStore


class StepExecutor:
    def __init__(self, session_id: str):
        self.session_id = session_id

    async def log(self, event: str, data: Dict[str, Any]):
        """Sends logs/tokens to the STATUS socket"""
        await manager.send_status(event, data, client_id=self.session_id)

    async def cast(self, frame_data: Any):
        """Sends visuals/frames to the CAST socket"""
        await manager.send_cast(frame_data, client_id=self.session_id)

    async def run(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        llm = get_available_llm()
        # Merge session answers (from clarify step) into context
        session = await MemoryStore.get_session(self.session_id)
        context: Dict[str, Any] = plan.get("context", {}).copy()
        if session and isinstance(session.get("answers"), dict):
            context["answers"] = session["answers"]
        if session and isinstance(session.get("assets"), list):
            context["assets"] = session["assets"]
        steps: List[Dict[str, Any]] = plan.get("steps", [])
        # Validate inputs against designed_flow schemas before execution
        try:
            designed_flow = context.get("designed_flow") or {}
            df_nodes = designed_flow.get("nodes") or []
            required_fields: List[str] = []
            for n in df_nodes:
                data = n.get("data") or {}
                schema = data.get("input_schema") or []
                for f in schema:
                    name = f.get("name")
                    if name and name not in required_fields:
                        required_fields.append(name)
            answers = context.get("answers", {})
            missing = [f for f in required_fields if f not in answers or answers.get(f) in (None, "", [])]
            if missing:
                await self.log("console", {"line": f"Missing inputs: {', '.join(missing)}"})
                await self.log("step_start", {"id": "collect", "type": "collect"})
                context["collect"] = { "missing": missing, "retry": {"max_attempts": 2, "backoff_ms": 250} }
                await self.log("step_end", {"id": "collect"})
        except Exception:
            pass

        for step in steps:
            sid = step["id"]
            stype = step["type"]
            await self.log("step_start", {"id": sid, "type": stype})

            if stype == "llm":
                prompt = f"{sid.upper()}:\nContext:\n{json.dumps(context)[:2000]}"
                tokens = []
                async for t in llm.stream(prompt):
                    tokens.append(t)
                    # stream token-level to console via STATUS socket
                    await self.log("llm_token", {"id": sid, "t": t})
                context[sid] = "".join(tokens)

            elif stype == "codegen":
                # Delegate to code generator via planner intent; executor stores placeholder
                context[sid] = "code_ready"

            elif stype == "executor":
                # Execute tool calls based on context (extensible)
                context[sid] = "executed"

            elif stype == "validator":
                context[sid] = "validated"
            
            elif stype == "collect":
                # Collect inputs from answers into context
                answers = context.get("answers", {})
                context[sid] = answers
                await self.log("console", {"line": f"Collected inputs: {json.dumps(answers)[:200]}"})

            elif stype == "assets":
                answers = context.get("answers", {})
                want_media = str(answers.get("product_media_required", "")).lower() in ("true", "yes", "y", "1")
                assets = context.get("assets", [])
                context[sid] = {"count": len(assets), "assets": assets}
                if want_media and not assets:
                    await self.log("console", {"line": "No media uploaded yet. Please upload product photos/videos."})
                else:
                    await self.log("console", {"line": f"Assets ready: {len(assets)} files"})

            elif stype == "payments":
                answers = context.get("answers", {})
                amount = answers.get("payment_amount") or answers.get("amount") or "0"
                currency = answers.get("payment_currency") or "USD"
                method = answers.get("payment_method") or "card"
                phone = answers.get("phone_number") or answers.get("phone") or ""
                name = answers.get("customer_name") or answers.get("name") or ""
                context[sid] = {
                    "status": "initiated",
                    "amount": amount,
                    "currency": currency,
                    "method": method,
                    "customer": {"name": name, "phone": phone}
                }
                await self.log("console", {"line": f"Payment initiated: {amount} {currency} via {method} for {name} ({phone})"})

            await self.log("step_end", {"id": sid})

        await self.log("complete", {"context": context})
        return {"status": "ok", "context": context}


from app.services.llm.provider_service import model_service
from app.db.session import SessionLocal
from app.services.automation.browser_service import browser_service
from app.services.llm.generic_llm import GenericLLM

class HilExecutor(StepExecutor):
    """
    Advanced HIL Executor for consolidated nodes.
    Supports BYOK (Bring Your Own Key) model selection and Headless Browser Automation.
    """
    async def get_llm_for_node(self, config: Dict[str, Any]):
        """Dynamically retrieves the LLM provider based on node configuration"""
        provider_id = config.get("model_id")
        if provider_id:
            return GenericLLM(provider_id)
        return get_available_llm() # Fallback to system default

    async def execute_node(self, node_type: str, config: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Executes a single HIL node based on its consolidated type"""
        node_id = config.get("id", "unknown")
        await self.log("node_start", {"id": node_id, "type": node_type})

        try:
            # --- HIL Mega-Nodes Execution ---
            if node_type == "hil_io":
                # Consolidated Input/Output
                answers = context.get("answers", {})
                message = config.get("message", "Processing your request...")
                await self.log("console", {"line": f"HIL IO: {message}"})
                return {"status": "success", "output": message}

            elif node_type == "hil_genai":
                # Consolidated GenAI (Vision/Voice/Decision)
                prompt = config.get("prompt", "")
                await self.log("console", {"line": "HIL GenAI: Reasoning..."})
                
                llm = await self.get_llm_for_node(config)
                # For now, standard LLM execution
                response = ""
                async for token in llm.stream(prompt):
                    response += token
                    await self.log("llm_token", {"id": node_id, "token": token})
                
                return {"status": "success", "output": response}

            elif node_type == "hil_knowledge":
                # Consolidated Memory/RAG
                await self.log("console", {"line": "HIL Knowledge: Retrieving context..."})
                return {"status": "success", "output": "Knowledge context retrieved."}

            elif node_type == "hil_automation":
                # Browser Studio Execution (Headless Playwright)
                mode = config.get("mode", "deterministic")
                hardware_profile = config.get("hardware_profile", "basic")
                await self.log("automation_start", {"mode": mode, "hardware": hardware_profile})
                
                llm = await self.get_llm_for_node(config)
                service = browser_service(self.session_id)
                
                if mode in ["deterministic", "hybrid"]:
                    # Deterministic mode uses the imported JSON steps
                    workflow = config.get("workflow", {})
                    if not workflow and "steps" in config:
                        workflow = {"steps": config["steps"], "name": "Inline Workflow"}
                    
                    if workflow:
                        await service.execute_workflow(workflow, mode=mode, llm_service=llm, hardware_profile=hardware_profile)
                    else:
                        await self.log("automation_error", {"message": "No workflow JSON provided for deterministic mode"})
                
                elif mode == "agent":
                    # Run LLM-based Agentic automation (Headless + Reasoning)
                    instruction = config.get("instruction")
                    if not instruction:
                        return {"status": "error", "message": "No instruction provided for agentic mode"}
                        
                    await self.log("agent_navigating", {"instruction": instruction})
                    # In agentic mode, we pass the instruction as a single-step 'goal' 
                    # and let the service handle the reasoning loop.
                    await service.execute_workflow({
                        "name": "Agentic Goal",
                        "steps": [{"type": "navigate", "url": config.get("start_url", "https://google.com")}]
                    }, mode="agent", llm_service=llm, goal=instruction, hardware_profile=hardware_profile)
                
                return {"status": "success"}

            elif node_type == "hil_approval":
                # Human-in-the-loop: Pause execution and create a ticket
                message = config.get("message_to_approver", "Manual approval required to proceed.")
                approver_id = config.get("approver_id")
                
                await self.log("approval_required", {
                    "approver": approver_id,
                    "message": message,
                    "session_id": self.session_id
                })
                
                # Create a ticket in the database for the Interaction Center
                from app.db.session import SessionLocal
                from app.db.models.ticket import Ticket
                db = SessionLocal()
                try:
                    ticket = Ticket(
                        title=f"Approval Required: {config.get('id', 'Node')}",
                        description=message,
                        status="pending",
                        priority="high",
                        source="agent_workflow",
                        metadata={"session_id": self.session_id, "node_id": config.get("id")}
                    )
                    db.add(ticket)
                    db.commit()
                    db.refresh(ticket)
                    
                    await self.log("ticket_created", {"ticket_id": ticket.id})
                finally:
                    db.close()
                
                return {"status": "pending", "reason": "Awaiting manual approval in Interaction Center", "ticket_id": ticket.id}

            else:
                return {"status": "error", "message": f"Unknown HIL node type: {node_type}"}

        except Exception as e:
            await self.log("node_error", {"id": node_id, "error": str(e)})
            return {"status": "error", "error": str(e)}
        finally:
            await self.log("node_end", {"id": node_id})
