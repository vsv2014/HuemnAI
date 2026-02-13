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
        await manager.send_json({"event": event, "data": data}, client_id=self.session_id)

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
                await manager.send_json({"event": "console", "data": {"line": f"Missing inputs: {', '.join(missing)}"}}, client_id=self.session_id)
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
                    # stream token-level to console
                    await manager.send_json({"event": "llm_token", "data": {"id": sid, "t": t}}, client_id=self.session_id)
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
                await manager.send_json({"event": "console", "data": {"line": f"Collected inputs: {json.dumps(answers)[:200]}"}}, client_id=self.session_id)

            elif stype == "assets":
                answers = context.get("answers", {})
                want_media = str(answers.get("product_media_required", "")).lower() in ("true", "yes", "y", "1")
                assets = context.get("assets", [])
                context[sid] = {"count": len(assets), "assets": assets}
                if want_media and not assets:
                    await manager.send_json({"event": "console", "data": {"line": "No media uploaded yet. Please upload product photos/videos."}}, client_id=self.session_id)
                else:
                    await manager.send_json({"event": "console", "data": {"line": f"Assets ready: {len(assets)} files"}}, client_id=self.session_id)

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
                await manager.send_json({"event": "console", "data": {"line": f"Payment initiated: {amount} {currency} via {method} for {name} ({phone})"}}, client_id=self.session_id)

            await self.log("step_end", {"id": sid})

        await self.log("complete", {"context": context})
        return {"status": "ok", "context": context}
