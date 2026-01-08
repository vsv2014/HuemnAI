from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.services.status_service import start_status_watcher
from app.services.knowledge_service import start_reindexer
from app.core.tool_registry import load_tool_configs
from app.core.tool_setup import register_default_tools
from app.core.connector_manager import discover_and_enable_connectors


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
        yield
        # Shutdown
        pass
    
    app.router.lifespan_context = lifespan
