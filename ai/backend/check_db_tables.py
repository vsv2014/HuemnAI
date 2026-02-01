from sqlalchemy import create_engine, inspect
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings

def check_tables():
    database_url = settings.DATABASE_URL
    if "sqlite" in database_url:
        # Fix for relative path if needed, but usually settings handles it
        pass
        
    print(f"Connecting to: {database_url}")
    engine = create_engine(database_url)
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    print("\nExisting Tables:")
    for table in tables:
        print(f"- {table}")
        
    required_tables = ["evaluation_logs", "audit_logs", "agent_analytics_events"]
    missing = [t for t in required_tables if t not in tables]
    
    if missing:
        print(f"\n❌ Missing tables: {missing}")
    else:
        print("\n✅ All required enterprise tables exist.")

if __name__ == "__main__":
    check_tables()
