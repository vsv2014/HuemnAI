from celery import Celery
import asyncio
from app.core.config import settings
from app.orchestrator.executor.executor import StepExecutor
from app.orchestrator.memory.store import MemoryStore
from app.orchestrator.sandbox.runner import SandboxRunner
from app.services.socket_manager import manager

broker = settings.CELERY_BROKER_URL or settings.REDIS_URL
backend = settings.CELERY_RESULT_BACKEND or settings.REDIS_URL

celery_app = Celery("huemn", broker=broker, backend=backend)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
)


@celery_app.task
def sample_add(a, b):
    return a + b


@celery_app.task
def execute_orchestrator(session_id: str):
    async def _run():
        session = await MemoryStore.get_session(session_id)
        if not session or "plan" not in session:
            return {"status": "error", "context": {"error": "Session not found"}}
        executor = StepExecutor(session_id)
        result = await executor.run(session["plan"])
        MemoryStore.audit("execute", {"session_id": session_id, "result": result})
        return result
    return asyncio.run(_run())


@celery_app.task
def run_orchestrator_code(session_id: str, code: str):
    async def _run():
        runner = SandboxRunner(session_id)
        result = await runner.run_python(code)
        MemoryStore.audit("run_code", {"session_id": session_id, "result": result})
        return {"status": result.get("status", "done"), "returncode": result.get("returncode")}
    return asyncio.run(_run())


@celery_app.task
def orchestrator_daily_run(session_id: str):
    async def _run():
        try:
            session = await MemoryStore.get_session(session_id)
            if not session or "plan" not in session:
                await manager.send_json({"event": "console", "data": {"line": f"Daily run skipped: plan not found (session {session_id})"}}, client_id=session_id)
                return {"skipped": True}
            exe = StepExecutor(session_id)
            await manager.send_json({"event": "console", "data": {"line": "Daily automation run started"}}, client_id=session_id)
            result = await exe.run(session["plan"])
            await manager.send_json({"event": "console", "data": {"line": "Daily automation run completed"}}, client_id=session_id)
            return {"published": True, "result": result}
        except Exception as e:
            try:
                await manager.send_json({"event": "console", "data": {"line": f"Daily run failed: {e}"}}, client_id=session_id)
            except Exception:
                pass
            return {"published": False, "error": str(e)}
    return asyncio.run(_run())
