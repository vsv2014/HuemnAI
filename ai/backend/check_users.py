import sqlite3
import os

db_path = r'C:\Users\srava\huemn\ai\backend\huemn.db'
if not os.path.exists(db_path):
    print(f"Error: {db_path} not found")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT email, subscription_status, current_plan_id FROM user_accounts")
users = cursor.fetchall()

print("User status in huemn.db:")
for user in users:
    print(f"- {user[0]}: status={user[1]}, plan_id={user[2]}")

conn.close()
