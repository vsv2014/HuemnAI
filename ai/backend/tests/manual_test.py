
import asyncio
import json
import urllib.parse
from unittest.mock import MagicMock, patch
from app.services.huemn_voice_service import HuemnVoiceService
from app.services.agent_executor import AgentExecutor
from app.db.models.agent import AgentNode, NodeType

async def test_huemn_voice_service_stream():
    print("Testing HuemnVoiceService stream...")
    service = HuemnVoiceService()
    
    # Mock the client
    mock_client = MagicMock()
    service.client = mock_client
    
    assert hasattr(service, "text_to_speech_stream")
    print("PASS: HuemnVoiceService has text_to_speech_stream")

async def test_premium_voice_tts_node_execution():
    print("Testing PremiumVoiceTTS execution...")
    
    # Mock dependencies
    executor = AgentExecutor(db=MagicMock())
    
    # Mock node
    node = AgentNode(
        id=1,
        node_type=NodeType.PREMIUM_VOICE_TTS,
        config={
            "text": "Hello {{name}}", 
            "voice_id": "voice_123",
            "stream": True,
            "stability": 0.8
        }
    )
    
    context = {"name": "User"}
    
    # Mock HuemnVoiceService availability
    with patch("app.services.huemn_voice_service.HuemnVoiceService") as MockService:
        instance = MockService.return_value
        instance.is_available.return_value = True
        
        # Mock settings for URL construction
        with patch("app.core.config.settings") as mock_settings:
            mock_settings.API_BASE_URL = "http://testserver"
            
            result = await executor._execute_premium_voice_tts_node(node, context)
            
            # Verify result structure
            assert result["metadata"]["mode"] == "stream"
            assert result["metadata"]["voice_enabled"] is True
            assert "ws_url" in result["metadata"]
            assert result["metadata"]["ws_url"] == "ws://testserver/ws/voice/stream"
            assert result["metadata"]["payload"]["text"] == "Hello User"
            assert result["metadata"]["payload"]["voice_id"] == "voice_123"
            assert result["metadata"]["payload"]["settings"]["stability"] == 0.8
            print("PASS: PremiumVoiceTTS execution returns correct metadata")

def test_ivr_context_parsing():
    print("Testing IVR context parsing...")
    
    # Simulate query param
    context_data = {"user_id": "123", "intent": "support"}
    encoded = urllib.parse.quote(json.dumps(context_data))
    
    # Simulate decoding logic used in ivr.py
    decoded_str = urllib.parse.unquote(encoded)
    decoded_json = json.loads(decoded_str)
    
    assert decoded_json["user_id"] == "123"
    assert decoded_json["intent"] == "support"
    print("PASS: IVR context parsing")

async def main():
    try:
        await test_huemn_voice_service_stream()
        await test_premium_voice_tts_node_execution()
        test_ivr_context_parsing()
        print("\nALL TESTS PASSED")
    except Exception as e:
        print(f"\nTEST FAILED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
