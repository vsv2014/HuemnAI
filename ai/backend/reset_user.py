import sqlite3
import os

db_path = r'C:\Users\srava\huemn\ai\backend\huemn.db'
email = 'sravandara25@gmail.com'

if not os.path.exists(db_path):
    print(f"Error: Database not found at {db_path}")
    exit(1)

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Reset user to expired status so they MUST pay to access features
    cursor.execute(
        "UPDATE user_accounts SET subscription_status='expired', current_plan_id=NULL WHERE email=?",
        (email,)
    )
    
    # Also remove any active subscriptions for this user to ensure clean state
    cursor.execute(
        "DELETE FROM subscriptions WHERE user_id = (SELECT id FROM user_accounts WHERE email=?)",
        (email,)
    )
    
    conn.commit()
    print(f"Successfully reset {email} to expired status.")
    print("This will force the subscription modal to appear since the account is no longer in trial.")
    
except Exception as e:
    print(f"Error updating database: {e}")
finally:
    if 'conn' in locals():
        conn.close()
