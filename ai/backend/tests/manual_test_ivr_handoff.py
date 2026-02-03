
import asyncio
import json
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.ivr import router

# Create a minimal app for testing the router
app = FastAPI()
app.include_router(router, prefix="/api/ivr")

client = TestClient(app)

async def run_tests():
    print("Running manual IVR handoff tests...")
    
    # Test 1: Success case
    print("\nTest 1: Redirect Chat to Call - Success")
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
        response = client.post("/api/ivr/redirect-to-call", json=payload)
        
        # Verify response
        if response.status_code == 200 and response.json()["success"] == True:
            print("PASS: Response status 200 and success=True")
        else:
            print(f"FAIL: {response.status_code} - {response.text}")
            
        # Verify make_call was called with correct params
        mock_service.make_call.assert_called_once()
        call_args = mock_service.make_call.call_args[1]
        
        if call_args["to_number"] == "+1234567890" and \
           call_args["agent_id"] == 1 and \
           call_args["context"]["session_id"] == "test-session-123":
            print("PASS: make_call called with correct params")
        else:
            print(f"FAIL: make_call params incorrect: {call_args}")

    # Test 2: Service Unavailable
    print("\nTest 2: Redirect Chat to Call - Service Unavailable")
    with patch("app.api.ivr.telephony_service") as mock_service, \
         patch("app.api.ivr.get_db"):
        mock_service.is_available.return_value = False
        
        payload = {
            "phone_number": "+1234567890",
            "agent_id": 1
        }
        
        response = client.post("/api/ivr/redirect-to-call", json=payload)
        
        data = response.json()
        if response.status_code == 200 and data["success"] == False and "Telephony service not configured" in data["error"]:
            print("PASS: Service unavailable handled correctly")
        else:
            print(f"FAIL: {response.status_code} - {data}")

    # Test 3: Missing Params
    print("\nTest 3: Redirect Chat to Call - Missing Params")
    response = client.post("/api/ivr/redirect-to-call", json={"agent_id": 1})
    if response.status_code == 400:
        print("PASS: Missing phone_number rejected")
    else:
        print(f"FAIL: Status {response.status_code}")

if __name__ == "__main__":
    asyncio.run(run_tests())
