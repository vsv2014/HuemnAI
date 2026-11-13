from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.services.status_service import start_status_watcher
from app.services.knowledge_service import start_reindexer
from app.core.tool_registry import load_tool_configs
from app.core.tool_setup import register_default_tools
from app.core.connector_manager import discover_and_enable_connectors
from app.services.status_service import start_token_consumer
from app.services.event_bus import start_forwarder
from app.services.workflow_scheduler import start_workflow_scheduler
from app.db.session import ping_database


def register_lifecycle(app: FastAPI):
    @asynccontextmanager
    async def lifespan(app_instance: FastAPI):
        # Startup
        # Register default tools and load DB config
        try:
            register_default_tools()
        except Exception:
            pass
        try:
            load_tool_configs()
        except Exception:
            pass
        ping_database()
        # Auto-discover connectors and enable if valid
        try:
            discover_and_enable_connectors()
        except Exception:
            pass
        # Production timers are owned by exactly one dedicated scheduler process.
        # Never start timers or event forwarders in every Gunicorn API worker.
        from app.core.config import settings
        import os
        if not settings.IS_PROD and os.getenv("HUEMN_DEV_INPROCESS_JOBS", "0") == "1":
            start_status_watcher()
            start_reindexer(interval_seconds=60 * 60 * 24)
            start_token_consumer(interval_seconds=300)
            import asyncio
            asyncio.create_task(start_forwarder())
            start_workflow_scheduler()
        yield
        # Shutdown
        pass
    
    app.router.lifespan_context = lifespan
