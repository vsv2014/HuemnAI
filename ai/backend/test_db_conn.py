from app.db.session import engine
from sqlalchemy import text
try:
    with engine.connect() as conn:
        print("Connected to PostgreSQL")
        conn.execute(text("SELECT 1"))
        print("Query successful")
except Exception as e:
    print(f"Connection failed: {e}")
