import logging
import structlog
import sentry_sdk
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.fastapi import FastApiIntegration
from app.core.config import settings


def setup_logging():
    """Configure structured logging and Sentry integration."""
    # Basic logging
    logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO), format="%(message)s")

    add_logger_name = getattr(structlog.processors, "add_logger_name", None)
    if add_logger_name is None:
        def add_logger_name(logger, method_name, event_dict):
            event_dict["logger"] = getattr(logger, "name", None)
            return event_dict

    # Structlog configuration
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            add_logger_name,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Sentry integration for errors and traces
    if settings.SENTRY_DSN:
        sentry_logging = LoggingIntegration(
            level=logging.INFO,        # Capture info and above as breadcrumbs
            event_level=logging.ERROR   # Send errors as events
        )
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            integrations=[sentry_logging, FastApiIntegration()],
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE
        )


def get_logger(name: str = None):
    return structlog.get_logger(name)
