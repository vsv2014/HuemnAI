import sys
import os
import asyncio
import json
import pytest
from unittest.mock import MagicMock, patch

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.services.huemn_voice_service import HuemnVoiceService

# Mock generator for text_to_speech_stream
async def mock_text_to_speech_stream(text, voice_id, model_id, **kwargs):
    yield b"chunk1"
    yield b"chunk2"
    yield b"chunk3"

def test_voice_stream_websocket():
    # Patch the HuemnVoiceService class
    with patch("app.api.voice_ws.HuemnVoiceService") as MockService:
        # Setup the mock instance
        mock_instance = MockService.return_value
        mock_instance.is_available.return_value = True
        mock_instance.text_to_speech_stream.side_effect = mock_text_to_speech_stream

        client = TestClient(app)

        with client.websocket_connect("/ws/voice/stream") as websocket:
            # Prepare payload
            payload = {
        "text": "Hello world",
        "voice_id": "voice_123",
        "model_id": "huemn_turbo_v2"
    }
            
            # Send text
            websocket.send_text(json.dumps(payload))
            
            # Receive binary chunks
            chunk1 = websocket.receive_bytes()
            assert chunk1 == b"chunk1"
            
            chunk2 = websocket.receive_bytes()
            assert chunk2 == b"chunk2"
            
            chunk3 = websocket.receive_bytes()
            assert chunk3 == b"chunk3"
            
            # Receive completion status
            status = websocket.receive_text()
            assert json.loads(status) == {"status": "done"}
            
            print("Voice WebSocket test passed!")

if __name__ == "__main__":
    try:
        test_voice_stream_websocket()
    except Exception as e:
        print(f"Test failed: {e}")
        import traceback
        traceback.print_exc()
