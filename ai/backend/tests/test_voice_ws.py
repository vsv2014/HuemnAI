import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.voice_ws import router as voice_ws_router
from unittest.mock import patch, AsyncMock
import json

# Minimal app for testing
app = FastAPI()
app.include_router(voice_ws_router)

client = TestClient(app)

def test_voice_stream_websocket():
    # Mock HuemnVoiceService
    with patch("app.api.voice_ws.HuemnVoiceService") as MockService:
        instance = MockService.return_value
        instance.is_available.return_value = True
        
        # Mock text_to_speech_stream to yield bytes
        async def mock_stream(*args, **kwargs):
            yield b"chunk1"
            yield b"chunk2"
        
        instance.text_to_speech_stream.side_effect = mock_stream

        with client.websocket_connect("/ws/voice/stream") as websocket:
            payload = {
        "text": "Hello world",
        "voice_id": "voice_123",
        "model_id": "huemn_turbo_v2",
        "settings": {}
    }
            websocket.send_json(payload)
            
            # Receive chunks
            data1 = websocket.receive_bytes()
            assert data1 == b"chunk1"
            
            data2 = websocket.receive_bytes()
            assert data2 == b"chunk2"
            
            # Receive done message
            data3 = websocket.receive_text()
            msg = json.loads(data3)
            assert msg["status"] == "done"

def test_voice_stream_service_unavailable():
    with patch("app.api.voice_ws.HuemnVoiceService", new_callable=AsyncMock) as MockService:
        instance = MockService.return_value
        instance.is_available.return_value = False
        
        with client.websocket_connect("/ws/voice/stream") as websocket:
            data = websocket.receive_json()
            assert "error" in data
            assert data["error"] == "Voice service not configured"
