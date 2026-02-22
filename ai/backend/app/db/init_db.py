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
from app.db.models import crm
from app.db.models import voice

def init_db():
    """
    Initialize database.

    In development (ENV == 'dev') we only ensure tables exist to preserve data.
    Use Alembic migrations for schema changes. Set DB_RESET_ON_STARTUP=1 to force reset.
    """
    from app.core.config import settings
    import os

    if settings.ENV == "dev":
        if os.getenv("DB_RESET_ON_STARTUP", "0") == "1":
            Base.metadata.drop_all(bind=engine)
            Base.metadata.create_all(bind=engine)
            print("Database reset and initialized (dev mode, DB_RESET_ON_STARTUP=1)")
        else:
            Base.metadata.create_all(bind=engine)
            print("Database checked/initialized without reset (dev mode)")
    else:
        # In production, do not create/drop tables automatically
        print("Skipping automatic DB init in non-dev environment. Use Alembic migrations to manage schema.")
