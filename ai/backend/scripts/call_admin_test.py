from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
settings.ADMIN_API_KEY = 'adminkey123'
client = TestClient(app)
res = client.post('/api/admin/tools/status_updater/config', headers={'x-api-key':'adminkey123'}, json={'enabled': True})
print('status:', res.status_code)
print('text:', res.text)
try:
    print('json:', res.json())
except Exception as e:
    print('json error', e)