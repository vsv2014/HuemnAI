import asyncio
import sys
import os
from unittest.mock import MagicMock, patch, AsyncMock

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.agent_executor import AgentExecutor
from app.db.models.agent import AgentNode

async def test_retry_logic():
    print("Starting Retry Logic Test...")
    
    # Mock DB Session
    mock_db = MagicMock()
    
    # Initialize Executor
    executor = AgentExecutor(db=mock_db)
    
    # Create a Mock Node with Retry Config
    node = AgentNode(
        id=1,
        name="Test API Node",
        node_type="api_call",
        config={
            "url": "http://httpbin.org/status/503", # Always fails
            "method": "GET",
            "retries": 2, # Should try 3 times total (1 initial + 2 retries)
            "timeout": 1
        }
    )
    
    context = {}
    
    print(f"Testing Node: {node.config}")
    
    # Mock Circuit Breaker
    mock_breaker = MagicMock()
    
    # Correctly mock the call method to await the passed function
    async def side_effect(func, *args, **kwargs):
        return await func(*args, **kwargs)
        
    mock_breaker.call = AsyncMock(side_effect=side_effect)
    
    # Mock aiohttp
    with patch('app.core.reliability.get_circuit_breaker', return_value=mock_breaker), \
         patch('aiohttp.ClientSession.request') as mock_request:
        
        # Mock Response Context Manager
        mock_response = MagicMock()
        mock_response.status = 503
        mock_response.text = AsyncMock(return_value="Service Unavailable")
        mock_response.json = AsyncMock(return_value={"error": "Service Unavailable"})
        
        # Async Context Manager Mocking
        mock_ctx = MagicMock()
        mock_ctx.__aenter__.return_value = mock_response
        mock_ctx.__aexit__.return_value = None
        
        mock_request.return_value = mock_ctx
        
        # Run Execution
        import time
        start = time.time()
        # Mocking sleep to speed up test
        with patch('asyncio.sleep', new_callable=AsyncMock) as mock_sleep:
            result = await executor._execute_api_node(node, context)
        
        duration = time.time() - start
        
        print("\n--- Test Results ---")
        print(f"Result Metadata: {result.get('metadata')}")
        
        # Verification
        metadata = result.get('metadata', {})
        if metadata.get('retries_exhausted'):
            print("✅ Retry Logic Verified: Retries exhausted as expected.")
        else:
            print("❌ Retry Logic Failed: Did not exhaust retries or missing metadata.")
            
        # Check call count
        # Initial + 2 retries = 3 calls
        print(f"API Call Count: {mock_request.call_count}")
        if mock_request.call_count == 3:
             print("✅ Call Count Verified: 3 attempts made.")
        else:
             print(f"❌ Call Count Mismatch: Expected 3, got {mock_request.call_count}")

if __name__ == "__main__":
    asyncio.run(test_retry_logic())
