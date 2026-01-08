import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'backend'))
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

settings.ADMIN_API_KEY = 'adminkey123'
client = TestClient(app)

print('GET /health ->', client.get('/health').status_code, client.get('/health').json())
# Ensure default tools are registered for this test-run
from app.core.tool_setup import register_default_tools
register_default_tools()
res = client.get('/api/admin/tools', headers={'x-api-key':'adminkey123'})
print('GET /api/admin/tools ->', res.status_code, res.json())
print('GET /api/status/available ->', client.get('/api/status/available').status_code)
print('POST /api/chat/handle ->', client.post('/api/chat/handle', json={'user_id':'u1','message':'hi'}).status_code)
print('POST /api/knowledge/reindex ->', client.post('/api/knowledge/reindex', headers={'x-api-key':'adminkey123'}).status_code)
print('GET /api/products/widget ->', client.get('/api/products/widget').status_code)
