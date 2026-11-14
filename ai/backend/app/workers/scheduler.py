"""Run the single scheduler/forwarder process outside Gunicorn API workers.

Deploy exactly one scheduler replica. Celery worker replicas handle queued work.
A workflow event may still be delivered more than once following a crash:
downstream side effects must be idempotent using the persisted task ID.
"""
import asyncio
import logging
from app.core.logging import setup_logging
from app.services.workflow_scheduler import start_workflow_scheduler
from app.services.knowledge_crawler_scheduler import start_knowledge_crawler_scheduler
from app.services.knowledge_service import start_reindexer
from app.services.status_service import start_status_watcher, start_token_consumer
from app.services.event_bus import start_forwarder


def main() -> None:
    setup_logging()
    logging.getLogger(__name__).info("Starting dedicated Huemn scheduler process")
    start_status_watcher()
    start_token_consumer(interval_seconds=300)
    start_knowledge_crawler_scheduler()
    start_reindexer(interval_seconds=60 * 60 * 24)
    start_workflow_scheduler()
    # Persistent async forwarder keeps the process alive and is restarted by Docker.
    asyncio.run(start_forwarder())


if __name__ == "__main__":
    main()
