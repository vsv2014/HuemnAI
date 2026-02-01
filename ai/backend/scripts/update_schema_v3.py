
import sqlite3
import os

DB_PATH = "huemn_ai.db"  # Adjust if path is different in config

def migrate():
    print(f"Connecting to database at {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. Add Shadow Mode columns to agents table
    try:
        cursor.execute("ALTER TABLE agents ADD COLUMN shadow_mode_enabled BOOLEAN DEFAULT 0")
        print("Added shadow_mode_enabled to agents")
    except sqlite3.OperationalError as e:
        print(f"Skipping shadow_mode_enabled: {e}")

    try:
        cursor.execute("ALTER TABLE agents ADD COLUMN shadow_agent_id INTEGER REFERENCES agents(id)")
        print("Added shadow_agent_id to agents")
    except sqlite3.OperationalError as e:
        print(f"Skipping shadow_agent_id: {e}")

    # 2. Add debug_trace to agent_conversations table
    try:
        cursor.execute("ALTER TABLE agent_conversations ADD COLUMN debug_trace JSON")
        print("Added debug_trace to agent_conversations")
    except sqlite3.OperationalError as e:
        print(f"Skipping debug_trace: {e}")

    conn.commit()
    conn.close()
    print("Migration completed.")

if __name__ == "__main__":
    migrate()
