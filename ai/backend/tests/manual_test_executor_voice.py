import asyncio
import os
import sys
from unittest.mock import MagicMock, AsyncMock, patch

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.agent_executor import AgentExecutor
from app.services.huemn_voice_service import HuemnVoiceService
from app.db.models.agent import AgentNode, NodeType

async def test_premium_voice_node_execution():
    print("Starting HuemnVoice TTS Node Verification...")
    
    # Mock dependencies
    with patch('app.services.huemn_voice_service.HuemnVoiceService') as MockService:
        # Setup mock service
        mock_instance = MockService.return_value
        mock_instance.is_available.return_value = True
        mock_instance.text_to_speech = AsyncMock(return_value=b"fake_audio_content")
        
        # Initialize Executor
        executor = AgentExecutor(db=MagicMock())
        
        # Test Case 1: Non-Streaming Mode
        print("\nTest Case 1: Non-Streaming Mode")
        node_config = {
            "text": "Hello, this is a test.",
            "voice_id": "voice_123",
            "model_id": "huemn_turbo_v2",
            "stream": False,
            "stability": 0.5
        }
        
        node = AgentNode(
            id=1,
            node_type=NodeType.PREMIUM_VOICE_TTS,
            name="Voice Node",
            config=node_config
        )
        
        context = {"user_name": "Test User"}
        
        # Execute
        result = await executor._execute_premium_voice_tts_node(node, context)
        
        # Verify
        if result.get("metadata", {}).get("audio_url"):
            print("✅ Non-Streaming execution successful")
            print(f"   Audio URL: {result['metadata']['audio_url']}")
            print(f"   Response: {result['response']}")
        else:
            print("❌ Non-Streaming execution failed")
            print(f"   Result: {result}")

        # Test Case 2: Streaming Mode
        print("\nTest Case 2: Streaming Mode")
        node_config_stream = {
            "text": "Hello, streaming test.",
            "voice_id": "voice_123",
            "stream": True
        }
        
        node_stream = AgentNode(
            id=2,
            node_type=NodeType.PREMIUM_VOICE_TTS,
            name="Streaming Voice Node",
            config=node_config_stream
        )
        
        # Execute
        result_stream = await executor._execute_premium_voice_tts_node(node_stream, context)
        
        # Verify
        metadata = result_stream.get("metadata", {})
        if metadata.get("mode") == "stream" and metadata.get("ws_url"):
            print("✅ Streaming execution successful")
            print(f"   WS URL: {metadata['ws_url']}")
            print(f"   Payload: {metadata['payload']}")
        else:
            print("❌ Streaming execution failed")
            print(f"   Result: {result_stream}")

if __name__ == "__main__":
    asyncio.run(test_premium_voice_node_execution())
