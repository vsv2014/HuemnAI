from app.db.session import SessionLocal
from app.db.models.subscription import UserAccount
from app.api.auth import hash_password
from app.utils.subscription import sync_tool_subscriptions
from datetime import datetime, timedelta

def force_create_dev_user():
    db = SessionLocal()
    try:
        user = db.query(UserAccount).filter(UserAccount.email == "dev@huemn.ai").first()
        if not user:
            print("Creating dev@huemn.ai user...")
            user = UserAccount(
                email="dev@huemn.ai",
                password_hash=hash_password("dev-bypass-2024"),
                name="Developer",
                subscription_status="trial",
                trial_started_at=datetime.utcnow(),
                trial_ends_at=datetime.utcnow() + timedelta(days=365),
                is_verified=True,
                is_active=True,
                has_used_trial=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            print("User dev@huemn.ai already exists. Updating status...")
            user.subscription_status = "trial"
            user.is_verified = True
            user.is_active = True
            db.commit()

        print("Syncing tool subscriptions...")
        sync_tool_subscriptions(db, user)
        print("Success!")
            
    finally:
        db.close()

if __name__ == "__main__":
    force_create_dev_user()
