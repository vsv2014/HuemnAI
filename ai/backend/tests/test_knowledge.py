from fastapi.testclient import TestClient
from app.main import app
from app.services.knowledge_service import index_all_connectors, TICKET_INDEX

client = TestClient(app)

def test_knowledge_index_and_query():
    index_all_connectors()
    assert len(TICKET_INDEX) > 0
    res = client.post("/api/knowledge/", json={"message": "login"})
    assert res.status_code == 200
    data = res.json()
    assert "results" in data
