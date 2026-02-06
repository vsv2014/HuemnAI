import asyncio
import json
from typing import Dict, Any, List, Optional, Callable
from app.llm.registry import get_available_llm
from app.services.socket_manager import manager


class StepExecutor:
    def __init__(self, session_id: str):
        self.session_id = session_id

    async def log(self, event: str, data: Dict[str, Any]):
        await manager.send_json({"event": event, "data": data}, client_id=self.session_id)

    async def run(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        llm = get_available_llm()
        context: Dict[str, Any] = plan.get("context", {}).copy()
        steps: List[Dict[str, Any]] = plan.get("steps", [])

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

            await self.log("step_end", {"id": sid})

        await self.log("complete", {"context": context})
        return {"status": "ok", "context": context}
