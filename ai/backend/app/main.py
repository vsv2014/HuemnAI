from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from app.api import chat, actions, feedback
from app.api.status import router as status_router
from app.api.products import router as products_router
from app.api.tickets import router as tickets_router
from app.db.init_db import init_db
from app.api.ws_status import router as ws_router
from app.api.voice_ws import router as voice_ws_router
from app.api import knowledge, hr, auth, subscription, demo_request, analytics, widget, ticket_assigner
from app.api import webhooks, config as config_api, tools as tools_api, ticket_solver, knowledge_sources
from app.api import agents, agent_templates
from app.api import enterprise, ivr, conversations, voice, stt, feature_flags, crm
from app.api import crm_ws
from app.api import workflow
from app.core.lifecycle import register_lifecycle
from app.services.status_service import start_status_watcher
from app.services.knowledge_crawler_scheduler import start_knowledge_crawler_scheduler
from app.services.status_service import start_token_consumer
from app.db.session import ping_database
from app.core.redis import redis_client
from app.core.config import settings
from app.core.logging import get_logger
import sentry_sdk
import time
import uuid

# Initialize structured logging and Sentry
from app.core.logging import setup_logging
setup_logging()

# Initialize DB (will not auto-drop/create in non-dev environments)
init_db()

app = FastAPI(title="HUEMN.Ai")
http_logger = get_logger("http")

# Mount uploads directory
import os
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# register lifecycle for background jobs
register_lifecycle(app)

# Start status watcher for activity tracking
start_status_watcher()

# Start knowledge crawler scheduler
start_knowledge_crawler_scheduler()
start_token_consumer(interval_seconds=60)

# Initialize Prometheus Metrics
Instrumentator().instrument(app).expose(app, include_in_schema=False)

app.include_router(ws_router)
app.include_router(voice_ws_router)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    start = time.perf_counter()
    try:
        response = await call_next(request)
        duration_ms = int((time.perf_counter() - start) * 1000)
        http_logger.info(
            "request",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
            client_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        response.headers["x-request-id"] = request_id
        return response
    except Exception as exc:
        duration_ms = int((time.perf_counter() - start) * 1000)
        http_logger.error(
            "request_error",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            duration_ms=duration_ms,
            error=str(exc)
        )
        if settings.SENTRY_DSN:
            sentry_sdk.capture_exception(exc)
        raise

@app.get("/")
async def root():
    return {"message": "HUEMN.Ai API", "version": "2.0.0", "tools": ["ticketing", "ticket_assigner", "status_updater", "knowledge_ai", "hr_services"]}

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/health/ready")
async def health_ready():
    db_status = "ok"
    redis_status = "ok"
    detail = {}
    try:
        ping_database()
    except Exception as exc:
        db_status = "error"
        detail["database"] = str(exc)
    try:
        await redis_client.ping()
    except Exception as exc:
        redis_status = "error"
        detail["redis"] = str(exc)
    status = "ok" if (db_status == "ok" and redis_status == "ok") else "degraded"
    return {"status": status, "database": db_status, "redis": redis_status, "detail": detail}

app.include_router(chat.router, prefix="/api/chat")
app.include_router(actions.router, prefix="/api/actions")
app.include_router(feedback.router, prefix="/api/feedback")
app.include_router(status_router, prefix="/api/status")
app.include_router(products_router, prefix="/api/products")
app.include_router(tickets_router, prefix="/api/tickets")
app.include_router(knowledge.router, prefix="/api/knowledge")
app.include_router(knowledge_sources.router, prefix="/api/knowledge")
app.include_router(hr.router, prefix="/api/hr")
app.include_router(auth.router, prefix="/api/auth")
app.include_router(subscription.router, prefix="/api/subscription")
app.include_router(demo_request.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(widget.router, prefix="/api")
app.include_router(ticket_assigner.router, prefix="/api/ticket-assigner")
app.include_router(webhooks.router, prefix="/api/webhooks")
app.include_router(config_api.router, prefix="/api/config")
app.include_router(tools_api.router, prefix="/api/tools")
app.include_router(ticket_solver.router, prefix="/api/ticket-solver")
app.include_router(agents.router, prefix="/api/agents")
app.include_router(agent_templates.router, prefix="/api/agent-templates")
app.include_router(ivr.router, prefix="/api/ivr")
app.include_router(enterprise.router, prefix="/api")
app.include_router(conversations.router, prefix="/api/conversations")
app.include_router(voice.router, prefix="/api/voice")
app.include_router(stt.router, prefix="/api/stt")
app.include_router(feature_flags.router, prefix="/api/feature-flags")
app.include_router(crm.router, prefix="/api/crm")
app.include_router(crm_ws.router)
app.include_router(workflow.router, prefix="/api/workflow")

# Routing / Agent Console
from app.api import routing
app.include_router(routing.router, prefix="/api/routing")

# Audit logs
from app.api import audit
app.include_router(audit.router, prefix="/api/audit")

# Agent Builder
from app.api import agent_builder
app.include_router(agent_builder.router, prefix="/api/agent-builder")


# Trace router
from app.api.endpoints import trace
app.include_router(trace.router, prefix="/api/trace")

# Evaluation router
from app.api.endpoints import evaluation
app.include_router(evaluation.router, prefix="/api/evaluation")

# Voice router
from app.api import voice
# app.include_router(voice.router, prefix="/api/voice")  # Duplicate removed

# Voice WebSocket router
from app.api import voice_ws
app.include_router(voice_ws.router, prefix="/api/voice-ws")

# Call Transcript WebSocket router
from app.api import transcript_ws
app.include_router(transcript_ws.router, prefix="/api/routing")

# Admin router (protected by ADMIN_API_KEY if set)
from app.api import admin as admin_router
app.include_router(admin_router.router, prefix="/api/admin")

# Orchestrator router
from app.orchestrator.api.router import router as orchestrator_router
app.include_router(orchestrator_router, prefix="/api/orchestrator")

# Sync Gateway router
from app.gateway.sync_router import router as sync_router
app.include_router(sync_router, prefix="/api")
