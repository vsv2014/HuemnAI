
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock
from app.api.ivr import router

# Create a minimal app for testing the router
app = FastAPI()
app.include_router(router, prefix="/api/ivr")

client = TestClient(app)

# Mock get_db dependency
# We can override the dependency in the app, but since we are patching the service,
# the DB might not be used if we mock correctly or if the endpoint logic permits.
# However, redirect_chat_to_call uses get_db.

@pytest.mark.asyncio
async def test_redirect_chat_to_call_success():
    # Mock the telephony service and get_db
    with patch("app.api.ivr.telephony_service") as mock_service, \
         patch("app.api.ivr.get_db") as mock_get_db:
        
        # Setup mock behavior
        mock_service.is_available.return_value = True
        mock_service.make_call = AsyncMock(return_value={
            "success": True,
            "call_sid": "CA12345",
            "status": "queued"
        })
        
        # Test payload
        payload = {
            "phone_number": "+1234567890",
            "agent_id": 1,
            "session_id": "test-session-123",
            "context": {
                "user_name": "John Doe",
                "last_intent": "support"
            }
        }
        
        # Make request
        # Note: We need to override the dependency if it's not mocked by patch (patch mocks the import)
        # But get_db is imported in ivr.py, so patching app.api.ivr.get_db should work.
        
        response = client.post("/api/ivr/redirect-to-call", json=payload)
        
        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["call_sid"] == "CA12345"
        
        # Verify make_call was called with correct params
        mock_service.make_call.assert_called_once()
        call_args = mock_service.make_call.call_args[1]
        assert call_args["to_number"] == "+1234567890"
        assert call_args["agent_id"] == 1
        assert call_args["context"]["session_id"] == "test-session-123"
        assert call_args["context"]["original_context"]["user_name"] == "John Doe"

@pytest.mark.asyncio
async def test_redirect_chat_to_call_service_unavailable():
    with patch("app.api.ivr.telephony_service") as mock_service, \
         patch("app.api.ivr.get_db"):
        mock_service.is_available.return_value = False
        
        payload = {
            "phone_number": "+1234567890",
            "agent_id": 1
        }
        
        response = client.post("/api/ivr/redirect-to-call", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == False
        assert "Telephony service not configured" in data["error"]

@pytest.mark.asyncio
async def test_redirect_chat_to_call_missing_params():
    # Missing phone_number
    response = client.post("/api/ivr/redirect-to-call", json={"agent_id": 1})
    assert response.status_code == 400
    
    # Missing agent_id
    response = client.post("/api/ivr/redirect-to-call", json={"phone_number": "+1234567890"})
    assert response.status_code == 400
