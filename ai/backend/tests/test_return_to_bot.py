
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_return_to_bot_success():
    with patch("app.api.ivr.telephony_service") as mock_service, \
         patch("app.api.ivr.get_db") as mock_get_db:
        
        # Setup mock behavior
        mock_service.is_available.return_value = True
        mock_service.redirect_call.return_value = {
            "success": True,
            "call_sid": "CA12345",
            "status": "redirected",
            "to_url": "http://test/api/ivr/call-handler"
        }
        
        call_sid = "CA12345"
        response = client.post(f"/api/ivr/calls/{call_sid}/return-to-bot")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["status"] == "redirected"
        
        # Verify redirect_call was called
        mock_service.redirect_call.assert_called_once()
        args = mock_service.redirect_call.call_args
        assert args[0][0] == call_sid
        assert "api/ivr/call-handler" in args[0][1]

def test_return_to_bot_service_unavailable():
    with patch("app.api.ivr.telephony_service") as mock_service, \
         patch("app.api.ivr.get_db"):
        
        mock_service.is_available.return_value = False
        
        call_sid = "CA12345"
        response = client.post(f"/api/ivr/calls/{call_sid}/return-to-bot")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == False
        assert "Telephony service not configured" in data["error"]
