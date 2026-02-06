import asyncio
import json
from typing import Dict, Any, List, Optional
from app.llm.registry import get_available_llm


class PromptParser:
    async def parse(self, prompt: str) -> Dict[str, Any]:
        return {"raw": prompt}


class IntentDetector:
    async def detect(self, prompt: str) -> str:
        llm = get_available_llm()
        tokens = []
        system = "You are an intent classifier. Return a single intent label from: build_bot, generate_code, call_api, run_workflow."
        messages = [{"role": "system", "content": system}, {"role": "user", "content": prompt}]
        async for t in llm.stream(message=prompt, messages=messages, model=None):
            tokens.append(t)
        text = "".join(tokens).lower()
        for k in ["build_bot", "generate_code", "call_api", "run_workflow"]:
            if k in text:
                return k
        return "run_workflow"


class TaskPlanner:
    async def plan(self, parsed: Dict[str, Any], intent: str) -> Dict[str, Any]:
        base_steps: List[Dict[str, Any]] = [
            {"id": "analyze", "type": "llm", "desc": "Analyze prompt"},
            {"id": "plan", "type": "llm", "desc": "Draft plan"},
            {"id": "execute", "type": "executor", "desc": "Execute steps"},
            {"id": "validate", "type": "llm", "desc": "Validate results"},
            {"id": "respond", "type": "llm", "desc": "Compose response"},
        ]
        if intent == "generate_code":
            base_steps.insert(2, {"id": "codegen", "type": "codegen", "desc": "Generate code"})
        return {"intent": intent, "steps": base_steps, "context": parsed}


async def build_plan(prompt: str) -> Dict[str, Any]:
    parser = PromptParser()
    detector = IntentDetector()
    planner = TaskPlanner()
    parsed = await parser.parse(prompt)
    intent = await detector.detect(prompt)
    return await planner.plan(parsed, intent)
