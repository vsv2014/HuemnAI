import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.db.models.subscription import UserToolSubscription, UserAccount


client = TestClient(app)


def create_trial_user():
    email = f"token-test-{uuid.uuid4().hex}@example.com"
    res = client.post(
        "/api/auth/signup",
        json={"email": email, "password": "StrongPass1!", "name": "Token Test"}
    )
    assert res.status_code == 200
    data = res.json()
    return email, data["token"]


def set_tool_tokens(email: str, tool_name: str, remaining: int):
    db = SessionLocal()
    try:
        user = db.query(UserAccount).filter(UserAccount.email == email).first()
        tool_sub = db.query(UserToolSubscription).filter(
            UserToolSubscription.user_id == user.id,
            UserToolSubscription.tool_name == tool_name
        ).first()
        assert tool_sub is not None
        tool_sub.tokens_remaining = remaining
        tool_sub.tokens_total = remaining
        db.commit()
    finally:
        db.close()


def test_consume_token_blocks_when_exhausted():
    email, token = create_trial_user()
    set_tool_tokens(email, "customer_service", 1)
    headers = {"Authorization": f"Bearer {token}"}

    first = client.post("/api/subscription/consume-token/customer_service?tokens=1", headers=headers)
    assert first.status_code == 200

    second = client.post("/api/subscription/consume-token/customer_service?tokens=1", headers=headers)
    assert second.status_code == 403


def test_chat_issue_blocks_when_tokens_exhausted():
    email, token = create_trial_user()
    set_tool_tokens(email, "customer_service", 1)
    headers = {"Authorization": f"Bearer {token}"}

    ok = client.post("/api/chat/issue", json={"issue": "Hello"}, headers=headers)
    assert ok.status_code == 200

    blocked = client.post("/api/chat/issue", json={"issue": "Hello again"}, headers=headers)
    assert blocked.status_code == 403
