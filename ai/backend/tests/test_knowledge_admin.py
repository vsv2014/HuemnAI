from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

client = TestClient(app)

def test_reindex_requires_api_key(monkeypatch):
    monkeypatch.setenv('ADMIN_API_KEY', 'secret123')
    # reload settings object
    from importlib import reload
    reload(__import__('app.core.config', fromlist=['settings']))
    # Now call without header
    res = client.post('/api/knowledge/reindex')
    assert res.status_code == 403
    # call with header
    res2 = client.post('/api/knowledge/reindex', headers={'x-api-key': 'secret123'})
    assert res2.status_code == 200
    assert res2.json().get('reindexed') is True
