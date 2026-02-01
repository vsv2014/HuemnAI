import sys
import os

# Add parent directory to path so we can import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.base import Base
from app.db.session import engine
# Import the model to ensure it's registered with Base.metadata
from app.db.models.evaluation import EvaluationLog

def create_tables():
    print("Creating tables...")
    # This will only create tables that don't exist
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully.")

if __name__ == "__main__":
    create_tables()
