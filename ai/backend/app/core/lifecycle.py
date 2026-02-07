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


def register_lifecycle(app: FastAPI):
    @asynccontextmanager
    async def lifespan(app_instance: FastAPI):
        # Startup
        # Register default tools and load DB config
        register_default_tools()
        load_tool_configs()
        # Auto-discover connectors and enable if valid
        discover_and_enable_connectors()
        start_status_watcher()
        # start daily knowledge reindexer (short interval during dev)
        start_reindexer(interval_seconds=60 * 60 * 24)
        start_token_consumer(interval_seconds=300)
        try:
            import asyncio
            asyncio.create_task(start_forwarder())
        except Exception:
            pass
        try:
            start_workflow_scheduler()
        except Exception:
            pass
        yield
        # Shutdown
        pass
    
    app.router.lifespan_context = lifespan
