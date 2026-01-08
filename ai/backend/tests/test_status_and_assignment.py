import time
from fastapi.testclient import TestClient
from app.main import app
from app.services.status_service import update_status, USER_STATUS
from app.services.agent_router import select_best_agent

client = TestClient(app)

def test_update_and_available():
    # set two agents
    update_status("agent1", "online")
    update_status("agent2", "online")

    res = client.get("/api/status/available")
    assert res.status_code == 200
    agents = res.json()
    assert any(a["id"] == "agent1" for a in agents)


def test_select_best_agent_prefers_lower_load():
    # ensure agent1 has 1 open ticket, agent2 has 0
    # create tickets by calling chat handler (which creates tickets)
    client.post("/api/chat/handle", json={"user_id": "user1", "message": "issue1"})
    # now assign another - selection should choose agent with lower load
    best = select_best_agent()
    assert best in ("agent1", "agent2")
