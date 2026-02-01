from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.api import chat, actions, feedback
from app.api.status import router as status_router
from app.api.products import router as products_router
from app.api.tickets import router as tickets_router
from app.db.init_db import init_db
from app.api.ws_status import router as ws_router
from app.api import knowledge, hr, auth, subscription, demo_request, analytics, widget, ticket_assigner
from app.api import webhooks, config as config_api, tools as tools_api, ticket_solver, knowledge_sources
from app.api import agents, agent_templates
from app.api import enterprise, ivr, conversations
from app.core.lifecycle import register_lifecycle
from app.services.status_service import start_status_watcher
from app.services.knowledge_crawler_scheduler import start_knowledge_crawler_scheduler

# Initialize structured logging and Sentry
from app.core.logging import setup_logging
setup_logging()

# Initialize DB (will not auto-drop/create in non-dev environments)
init_db()

app = FastAPI(title="HUEMN.Ai")

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

app.include_router(ws_router)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "HUEMN.Ai API", "version": "2.0.0", "tools": ["ticketing", "ticket_assigner", "status_updater", "knowledge_ai", "hr_services"]}

@app.get("/health")
async def health():
    return {"status": "ok"}

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

# Audit logs
from app.api import audit
app.include_router(audit.router, prefix="/api/audit")

# Trace router
from app.api.endpoints import trace
app.include_router(trace.router, prefix="/api/trace")

# Evaluation router
from app.api.endpoints import evaluation
app.include_router(evaluation.router, prefix="/api/evaluation")

# Admin router (protected by ADMIN_API_KEY if set)
from app.api import admin as admin_router
app.include_router(admin_router.router, prefix="/api/admin")
