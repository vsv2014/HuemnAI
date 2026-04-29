from app.db.base import Base
from app.db.session import engine
# Import ALL models to ensure they are registered with Base.metadata
import app.db.models.user
import app.db.models.ticket
import app.db.models.conversation
import app.db.models.tool_config
import app.db.models.subscription
import app.db.models.status_history
import app.db.models.api_config
import app.db.models.knowledge
import app.db.models.agent
import app.db.models.enterprise
import app.db.models.audit
import app.db.models.hr
import app.db.models.crm
import app.db.models.voice
import app.db.models.campaign  # New model
import os

def reset_db():
    db_path = "huemn.db"
    if os.path.exists(db_path):
        print(f"Deleting existing database: {db_path}")
        try:
            os.remove(db_path)
        except PermissionError:
            print("Could not delete DB file, it might be in use. Dropping tables instead...")
            Base.metadata.drop_all(bind=engine)
    
    print("Creating all tables from scratch...")
    Base.metadata.create_all(bind=engine)
    print("Database reset successfully.")

if __name__ == "__main__":
    reset_db()
