from app.db.session import SessionLocal
from app.db.models.subscription import UserAccount, UserToolSubscription
import json

def check_user_and_tools():
    db = SessionLocal()
    try:
        user = db.query(UserAccount).filter(UserAccount.email == "dev@huemn.ai").first()
        if not user:
            print("User dev@huemn.ai NOT FOUND in database")
            return

        print(f"User: {user.email}")
        print(f"ID: {user.id}")
        print(f"Status: {user.subscription_status}")
        
        tools = db.query(UserToolSubscription).filter(UserToolSubscription.user_id == user.id).all()
        print(f"\nFound {len(tools)} tool subscriptions:")
        for t in tools:
            print(f"- {t.tool_name}: active={t.is_active}, status={t.subscription_status}, tokens={t.tokens_remaining}/{t.tokens_total}")
            
    finally:
        db.close()

if __name__ == "__main__":
    check_user_and_tools()
