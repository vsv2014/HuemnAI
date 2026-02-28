from app.db.init_db import init_db
import os
os.environ["DB_RESET_ON_STARTUP"] = "1"
try:
    init_db()
    print("Database initialized successfully on PostgreSQL")
except Exception as e:
    print(f"Database initialization failed: {e}")
