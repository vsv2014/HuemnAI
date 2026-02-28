import sqlite3
import os

db_path = 'huemn.db'
if not os.path.exists(db_path):
    print(f"Error: {db_path} not found")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get list of tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()

print("Tables in huemn.db:")
for table in tables:
    table_name = table[0]
    # Get row count for each table
    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
    count = cursor.fetchone()[0]
    print(f"- {table_name} ({count} rows)")

    # Get column info
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = cursor.fetchall()
    print("  Columns:")
    for col in columns:
        print(f"    - {col[1]} ({col[2]})")

conn.close()
