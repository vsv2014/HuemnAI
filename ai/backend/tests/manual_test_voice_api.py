
import sys
import os
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.main import app
from app.db.session import get_db
from app.api.auth import get_current_user
from app.db.models.subscription import UserAccount
from app.db.models.voice import VoiceProfile

# Mock Data
MOCK_USER = UserAccount(id=1, email="test@example.com", role="admin")
MOCK_VOICE_PROFILE = VoiceProfile(
    id=1,
    name="Test Voice",
    provider_voice_id="voice_123",
    user_id=1,
    is_public=False
)

def override_get_db():
    db = MagicMock(spec=Session)
    # Mock query for GET /profiles
    db.query.return_value.filter.return_value.all.return_value = [MOCK_VOICE_PROFILE]
    # Default to returning MOCK_VOICE_PROFILE for get_voice_profiles
    # But for create_voice_profile check, we might want None
    # We'll handle specific overrides in tests
    db.query.return_value.filter.return_value.first.return_value = MOCK_VOICE_PROFILE
    return db

def override_get_current_user():
    return MOCK_USER

app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(app)

def test_get_voice_profiles():
    print("\nTesting GET /api/voice/profiles...")
    
    with patch("app.api.voice.VoiceProfile") as MockModel:
        response = client.get("/api/voice/profiles")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        assert response.status_code == 200
        assert response.json()["success"] == True
        assert len(response.json()["profiles"]) >= 0

def test_create_voice_profile():
    print("\nTesting POST /api/voice/profiles...")
    payload = {
        "name": "New Voice",
        "provider_voice_id": "new_voice_id",
        "model_id": "huemn_turbo_v2"
    }
    
    # We need to mock the DB session specifically for this test to return None for the "existing" check
    # Since dependency overrides are global, we can temporarily change the mock behavior or patch the router's dependency
    
    # Let's try to patch the get_db dependency return value logic
    # The override_get_db returns a MagicMock. We can configure that mock.
    
    # However, since we are using TestClient with global overrides, it's stateful.
    # Let's try to use a specific patch for the db query inside the route if possible, 
    # OR better, update our override_get_db to be smarter.
    
    # Re-defining the override for this test context is tricky with TestClient already instantiated.
    # A cleaner way for this manual test is to modify the behavior of the *already injected* mock if possible,
    # or just patch the DB call inside the route using `patch.object`.
    
    # Let's try patching the Session.query method on the db instance that gets injected.
    # But we don't have easy access to that exact instance from here.
    
    # Alternative: Modify the override_get_db to return different things based on input? No, query construction is complex.
    
    # Let's use `unittest.mock.patch` on the `db` object that is returned by `get_db`.
    # But `get_db` is overridden.
    
    # Let's just create a new TestClient with a different override for this test?
    # Or simpler: Update the test to handle the 400 if it exists, but we want to test success.
    
    # Let's redefine the override and re-instantiate client for this function.
    
    mock_db = MagicMock(spec=Session)
    # First call is check existing -> return None
    # Second call might be something else
    mock_db.query.return_value.filter.return_value.first.return_value = None
    
    def custom_override():
        return mock_db
        
    app.dependency_overrides[get_db] = custom_override
    local_client = TestClient(app)
    
    with patch("app.api.voice.VoiceProfile") as MockModel:
        # We also need to ensure the DB add/commit doesn't fail
        response = local_client.post("/api/voice/profiles", json=payload)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        assert response.status_code == 200
        assert response.json()["success"] == True

def test_sync_voices():
    print("\nTesting POST /api/voice/sync...")
    with patch("app.api.voice.HuemnVoiceService") as MockService:
        mock_instance = MockService.return_value
        mock_instance.is_available.return_value = True
        
        # Make get_voices awaitable
        mock_instance.get_voices = AsyncMock(return_value=[])
        
        response = client.post("/api/voice/sync")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        assert response.status_code == 200
        assert "background" in response.json()["message"]

if __name__ == "__main__":
    try:
        test_get_voice_profiles()
        test_create_voice_profile()
        test_sync_voices()
        print("\nAll Voice API tests passed!")
    except Exception as e:
        print(f"\nTest failed: {e}")
        import traceback
        traceback.print_exc()
