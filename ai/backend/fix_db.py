
import sys
import os

# Add parent directory to path so we can import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.base import Base
from app.db.session import engine
from app.db.models.tool_config import ToolConfig
from sqlalchemy import inspect

def fix_db():
    print("Checking database...")
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"Existing tables: {tables}")
    
    if "tool_config" not in tables:
        print("tool_config table missing. Creating...")
        try:
            ToolConfig.__table__.create(bind=engine)
            print("tool_config table created successfully.")
        except Exception as e:
            print(f"Error creating table: {e}")
            # Try create all if specific fail
            Base.metadata.create_all(bind=engine)
    else:
        print("tool_config table already exists.")

if __name__ == "__main__":
    fix_db()
