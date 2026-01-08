import os
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

client = TestClient(app)


def test_admin_tools_list_and_update(monkeypatch):
    # set admin key
    monkeypatch.setattr(settings, "ADMIN_API_KEY", "adminkey123")

    # list tools (should succeed with admin header)
    res = client.get("/api/admin/tools", headers={"x-api-key": "adminkey123"})
    assert res.status_code == 200
    data = res.json()
    assert "tools" in data

    # update a tool config (toggle status_updater)
    res2 = client.post("/api/admin/tools/status_updater/config", headers={"x-api-key": "adminkey123"}, json={"enabled": True})
    if res2.status_code != 200:
        print('ADMIN CONFIG ERROR', res2.status_code, res2.text)
    assert res2.status_code == 200
    # fetch single tool
    res3 = client.get("/api/admin/tools/status_updater", headers={"x-api-key": "adminkey123"})
    assert res3.status_code == 200
    assert res3.json()["enabled"] is True
