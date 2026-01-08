from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_hr_post_and_shortlist():
    res = client.post("/api/hr/", json={"message": "post job: Backend Engineer | Experience in python"})
    assert res.status_code == 200
    assert "posted" in res.json()

    res2 = client.post("/api/hr/", json={"message": "shortlist: python"})
    assert res2.status_code == 200
    data = res2.json()
    assert "shortlist" in data
