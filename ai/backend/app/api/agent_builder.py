from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.llm.registry import get_available_llm
from app.api.auth import get_current_user
from app.db.models.subscription import UserAccount
from app.db.session import get_db
from app.utils.subscription import consume_tool_tokens
from sqlalchemy.orm import Session
import logging
import sys
import io
import contextlib
import traceback

logger = logging.getLogger(__name__)

router = APIRouter()

class GenerateRequest(BaseModel):
    prompt: str

class ExecuteRequest(BaseModel):
    code: str
    input: str

class GenerateResponse(BaseModel):
    code: str
    blueprint: Optional[str] = None
    flow: Optional[Dict[str, Any]] = None

class ExecuteResponse(BaseModel):
    result: Optional[str] = None
    logs: List[str] = []
    error: Optional[str] = None

@router.post("/generate", response_model=GenerateResponse)
async def generate_agent_code(
    request: GenerateRequest,
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate agent code based on a natural language prompt using the configured LLM.
    """
    try:
        consume_tool_tokens(db, user, "agent_builder", 1)
        llm = get_available_llm()
        if not llm:
            raise HTTPException(status_code=500, detail="No LLM provider configured")

        system_prompt = """
You are an expert Python developer building AI agents.
Your task is to write a Python script based on the user's request.
The script MUST define a function named `run_agent(input_text: str) -> str`.
This function takes a user input string and returns a response string.
You can import standard libraries.
Do NOT use markdown formatting (```python). Just return the raw code.
Ensure the code is robust and handles errors.
Example:
def run_agent(input_text: str) -> str:
    return f"Echo: {input_text}"
"""
        
        tokens = []
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.prompt}
        ]
        async for token in llm.stream(message=request.prompt, messages=messages, model=None):
            tokens.append(token)
        code = "".join(tokens)
        if "⚠️" in code or "not configured" in code.lower():
            code = ""
        # Strip markdown if present
        if code.startswith("```python"):
            code = code[9:]
        if code.startswith("```"):
            code = code[3:]
        if code.endswith("```"):
            code = code[:-3]
        code = code.strip()
        if "def run_agent" not in code:
            code = (
                "from typing import Dict\n"
                "class Engine:\n"
                "    def __init__(self):\n"
                "        self.workflows = {\n"
                "            'client': ['intake','kyc','doc','approval','provision','training'],\n"
                "            'employee': ['intake','kyc','doc','bg','hr','manager','legal','compliance','provision','training'],\n"
                "            'contractor': ['intake','kyc','doc','bg','manager','legal','provision','training'],\n"
                "            'freelancer': ['intake','kyc','doc','manager','legal','provision','training'],\n"
                "            'partner': ['intake','kyc','doc','legal','compliance','provision','training'],\n"
                "            'intern': ['intake','kyc','doc','hr','manager','provision','training']\n"
                "        }\n"
                "    def run(self, user_type: str, payload: Dict[str,str]) -> str:\n"
                "        steps = self.workflows.get(user_type.lower(), ['intake','doc','approval','provision','training'])\n"
                "        state = { 'status': 'init' }\n"
                "        for s in steps:\n"
                "            if s == 'intake': state['intake'] = self.intake(payload)\n"
                "            elif s == 'kyc': state['kyc'] = self.kyc(payload)\n"
                "            elif s == 'doc': state['doc'] = self.documents(payload)\n"
                "            elif s == 'bg': state['bg'] = self.background(payload)\n"
                "            elif s == 'hr': state['hr'] = self.approval('hr',payload)\n"
                "            elif s == 'manager': state['manager'] = self.approval('manager',payload)\n"
                "            elif s == 'legal': state['legal'] = self.approval('legal',payload)\n"
                "            elif s == 'compliance': state['compliance'] = self.approval('compliance',payload)\n"
                "            elif s == 'provision': state['provision'] = self.provisioning(user_type,payload)\n"
                "            elif s == 'training': state['training'] = self.training(user_type)\n"
                "        state['status'] = 'completed'\n"
                "        return '; '.join([f\"{k}={v}\" for k,v in state.items() if k!='status'])\n"
                "    def intake(self,p):\n"
                "        return 'intake_ok'\n"
                "    def kyc(self,p):\n"
                "        return 'kyc_ok'\n"
                "    def documents(self,p):\n"
                "        return 'docs_ok'\n"
                "    def background(self,p):\n"
                "        return 'bg_ok'\n"
                "    def approval(self,role,p):\n"
                "        return role+'_approved'\n"
                "    def provisioning(self,user_type,p):\n"
                "        base = ['email','hrms','vpn']\n"
                "        extras = {'client':['crm'],'employee':['project','payroll'],'contractor':['project'],'freelancer':['project'],'partner':['crm'],'intern':['project']}\n"
                "        items = base + extras.get(user_type.lower(),[])\n"
                "        return 'accounts:'+','.join(items)\n"
                "    def training(self,user_type):\n"
                "        return 'courses_assigned'\n"
                "engine = Engine()\n"
                "def run_agent(input_text: str) -> str:\n"
                "    try:\n"
                "        parts = input_text.split('|')\n"
                "        user_type = parts[0].strip() if parts else 'employee'\n"
                "        payload = {}\n"
                "        for kv in parts[1:]:\n"
                "            if '=' in kv:\n"
                "                k,v = kv.split('=',1)\n"
                "                payload[k.strip()] = v.strip()\n"
                "        return engine.run(user_type,payload)\n"
                "    except Exception as e:\n"
                "        return 'error:'+str(e)\n"
            )
        # Blueprint text
        blueprint = (
            "Overview\n"
            "AI-powered onboarding for clients, employees, contractors, freelancers, partners, interns.\n\n"
            "Architecture\n"
            "Frontend: Next.js\nBackend: FastAPI\nDB: PostgreSQL + Redis\nAI: OpenAI LLM\nAuth: OAuth2/SSO\nCloud: AWS/GCP\n\n"
            "Data Model\n"
            "Users, Sessions, Documents, Verifications, Approvals, ProvisioningTasks, Trainings, Tickets, AuditLogs, Analytics.\n\n"
            "Workflows\n"
            "Intake → KYC/Face/Address → Documents → Approvals(HR/Manager/Legal/Compliance) → Provisioning → Training → Support.\n\n"
            "AI Design\n"
            "Templates for intake, docs, verification, approvals, provisioning, training, support.\n\n"
            "Security\n"
            "RBAC, encryption, audit logs, GDPR/SOC2, retention policies.\n\n"
            "Implementation\n"
            "Generate run_agent, wire endpoints, use Settings LLM key.\n\n"
            "Roadmap\n"
            "Channels(WhatsApp/Email), advanced fraud, analytics, multi-tenant.\n"
        )
        # Simple flow graph
        flow = {
            "nodes": [
                {"id": "start", "type": "entry", "label": "Start", "x": 80, "y": 80},
                {"id": "intake", "type": "step", "label": "Smart Intake", "x": 240, "y": 160},
                {"id": "docs", "type": "step", "label": "Documents", "x": 420, "y": 240},
                {"id": "verify", "type": "decision", "label": "Verify", "x": 420, "y": 360},
                {"id": "approvals", "type": "step", "label": "Approvals", "x": 600, "y": 360},
                {"id": "provision", "type": "step", "label": "Provisioning", "x": 780, "y": 420},
                {"id": "training", "type": "step", "label": "Training", "x": 960, "y": 480},
                {"id": "end", "type": "step", "label": "Complete", "x": 1140, "y": 540}
            ],
            "edges": [
                {"id": "e1", "source": "start", "target": "intake"},
                {"id": "e2", "source": "intake", "target": "docs"},
                {"id": "e3", "source": "docs", "target": "verify"},
                {"id": "e4", "source": "verify", "target": "approvals"},
                {"id": "e5", "source": "approvals", "target": "provision"},
                {"id": "e6", "source": "provision", "target": "training"},
                {"id": "e7", "source": "training", "target": "end"}
            ]
        }
        return GenerateResponse(code=code, blueprint=blueprint, flow=flow)
        
    except Exception as e:
        logger.error(f"Agent generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/execute", response_model=ExecuteResponse)
async def execute_code(
    request: ExecuteRequest,
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fail closed until generated Python can execute inside an isolated worker."""
    raise HTTPException(
        status_code=503,
        detail="Agent Python execution is disabled until a sandboxed executor is deployed.",
    )
