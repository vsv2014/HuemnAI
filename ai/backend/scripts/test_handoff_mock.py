import asyncio
import sys
import os
import json
import logging
from unittest.mock import MagicMock, AsyncMock, patch

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Mock redis client before importing routing service
mock_redis = AsyncMock()
modules = {
    "app.core.redis": MagicMock(redis_client=mock_redis),
    "app.services.telephony_service": MagicMock(telephony_service=MagicMock())
}
with patch.dict(sys.modules, modules):
    from app.services.routing_service import RoutingService
    from app.schemas.node_configs import HandoffNodeConfig

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_handoff_logic():
    logger.info("Starting Handoff Logic Verification (Mocked)")
    
    session_id = "test-session-123"
    agent_id = "test-agent-001"
    queue_name = "test_support"
    
    # --- Test Enqueue ---
    logger.info("Test 1: Enqueue Logic")
    config = HandoffNodeConfig(
        queue_name=queue_name,
        priority=5,
        required_skills=["test"],
        handoff_message="Hold on"
    )
    context = {"user_id": "u1", "call_sid": "CA123456"}
    
    await RoutingService.enqueue_call(session_id, config, context)
    
    # Verify Redis calls
    # hset called for call data
    # mock_redis.hset.assert_any_call(f"{RoutingService.CALL_PREFIX}{session_id}", mapping=dict)
    
    # Verify first hset call
    found_call_hset = False
    for call in mock_redis.hset.call_args_list:
        args, kwargs = call
        if args[0] == f"{RoutingService.CALL_PREFIX}{session_id}":
            found_call_hset = True
            assert "mapping" in kwargs
            assert kwargs["mapping"]["session_id"] == session_id
            break
    
    if not found_call_hset:
        raise AssertionError("hset not called for call data")

    # zadd called for queue
    mock_redis.zadd.assert_called()
    logger.info("✅ Enqueue logic verified (Redis calls made)")

    # --- Test Assign Call (With Voice Bridge) ---
    logger.info("Test 2: Assign Call Logic")
    
    # Setup mock data for hgetall
    mock_redis.hgetall.return_value = {
        "session_id": session_id,
        "queue_name": queue_name,
        "context": json.dumps(context), # contains call_sid
        "status": "queued"
    }
    
    # Mock telephony service bridge
    from app.services.telephony_service import telephony_service
    telephony_service.bridge_to_client = MagicMock()
    
    await RoutingService.assign_call(session_id, agent_id)
    
    # Verify Redis updates
    # Call status update
    mock_redis.hset.assert_any_call(
        f"{RoutingService.CALL_PREFIX}{session_id}", 
        mapping={"status": "assigned", "agent_id": agent_id, "assigned_at": unittest.mock.ANY}
    )
    # Agent status update
    mock_redis.hset.assert_any_call(
        f"{RoutingService.AGENT_PREFIX}{agent_id}", 
        mapping={"status": "busy"}
    )
    # Queue removal
    mock_redis.zrem.assert_called_with(f"{RoutingService.QUEUE_PREFIX}{queue_name}", session_id)
    
    # Verify Voice Bridge
    telephony_service.bridge_to_client.assert_called_with("CA123456", agent_id)
    logger.info("✅ Voice Bridge called with correct CallSid")
    
    logger.info("🎉 Handoff Logic Verified Successfully!")

import unittest.mock

if __name__ == "__main__":
    asyncio.run(test_handoff_logic())
