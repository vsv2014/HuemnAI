from app.db.base import Base
from app.db.session import engine

# Import models so SQLAlchemy knows them
from app.db.models import user, ticket, conversation
# Tool config model
from app.db.models import tool_config
# Subscription models
from app.db.models import subscription
# Status history model for work time tracking
from app.db.models import status_history
# API configuration model
from app.db.models.api_config import APIConfig
# Knowledge base models
from app.db.models import knowledge
# Agent platform models
from app.db.models import agent
# Enterprise models
from app.db.models import enterprise
# Audit Log model
from app.db.models import audit
# HR models
from app.db.models import hr

def init_db():
    """
    Initialize database.

    In development (ENV == 'dev') we drop and recreate tables to keep schema in sync.
    In other environments we do not auto-mutate the schema - use Alembic migrations instead.
    """
    from app.core.config import settings

    if settings.ENV == "dev":
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        print("Database initialized with latest schema (dev mode)")
    else:
        # In production, do not create/drop tables automatically
        print("Skipping automatic DB init in non-dev environment. Use Alembic migrations to manage schema.")
