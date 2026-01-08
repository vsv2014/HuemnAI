"""
Quick script to check if api_configs table exists and create it if needed.
Run this if you get "no such table: api_configs" errors.
"""
from app.db.base import Base
from app.db.session import engine
from app.db.models.api_config import APIConfig

# Import all models
from app.db.models import user, ticket, conversation, tool_config, subscription, status_history

# Create only the api_configs table if it doesn't exist
try:
    APIConfig.__table__.create(bind=engine, checkfirst=True)
    print("✓ api_configs table created or already exists")
except Exception as e:
    print(f"Error creating table: {e}")
    # Try full init
    try:
        Base.metadata.create_all(bind=engine, tables=[APIConfig.__table__])
        print("✓ api_configs table created via metadata")
    except Exception as e2:
        print(f"Error: {e2}")

