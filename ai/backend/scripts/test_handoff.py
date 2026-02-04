import asyncio
import sys
import os
import json
import logging
import time

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.redis import redis_client
from app.services.routing_service import RoutingService
from app.schemas.node_configs import HandoffNodeConfig

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_handoff_flow():
    logger.info("Starting Handoff Flow Verification")
    
    # 1. Setup Data
    session_id = "test-session-123"
    agent_id = "test-agent-001"
    queue_name = "test_support"
    
    try:
        # Clean previous test data
        await redis_client.delete(f"{RoutingService.CALL_PREFIX}{session_id}")
        await redis_client.zrem(f"{RoutingService.QUEUE_PREFIX}{queue_name}", session_id)
        
        # 2. Simulate Enqueue
        logger.info("Step 2: Enqueueing Call")
        config = HandoffNodeConfig(
            queue_name=queue_name,
            priority=5,
            required_skills=["test"],
            handoff_message="Hold on"
        )
        context = {"user_id": "u1", "call_sid": "CA123456"} # Mimic IVR context
        
        success = await RoutingService.enqueue_call(session_id, config, context)
        if not success:
            logger.error("Enqueue failed")
            return
            
        # Verify Redis State
        call_data = await redis_client.hgetall(f"{RoutingService.CALL_PREFIX}{session_id}")
        if not call_data or call_data.get("status") != "queued":
             logger.error(f"Call data incorrect: {call_data}")
             return
        
        if call_data.get("queue_name") != queue_name:
             logger.error(f"Queue name mismatch: {call_data.get('queue_name')}")
             return

        in_queue = await redis_client.zscore(f"{RoutingService.QUEUE_PREFIX}{queue_name}", session_id)
        if in_queue is None:
             logger.error("Call not in ZSET queue")
             return
             
        logger.info("✅ Call Enqueued Successfully")
        
        # 3. Verify Get Queued Calls
        queued = await RoutingService.get_queued_calls(queue_name)
        found = any(q["session_id"] == session_id for q in queued)
        if not found:
             logger.error("Call not found in get_queued_calls")
             return
        logger.info("✅ Get Queued Calls Verified")

        # 4. Assign Agent
        logger.info("Step 4: Assigning Agent")
        
        # Note: assign_call tries to import telephony_service. 
        # If Twilio creds are missing, it might log error but return True for assignment logic.
        assigned = await RoutingService.assign_call(session_id, agent_id)
        if not assigned:
             logger.error("Assignment failed")
             return
        
        # Verify Redis State
        call_data_assigned = await redis_client.hgetall(f"{RoutingService.CALL_PREFIX}{session_id}")
        if call_data_assigned.get("status") != "assigned":
             logger.error(f"Status not updated to assigned: {call_data_assigned.get('status')}")
             return
             
        if call_data_assigned.get("agent_id") != agent_id:
             logger.error(f"Agent ID mismatch: {call_data_assigned.get('agent_id')}")
             return
        
        in_queue_after = await redis_client.zscore(f"{RoutingService.QUEUE_PREFIX}{queue_name}", session_id)
        if in_queue_after is not None:
             logger.error("Call still in ZSET queue after assignment")
             return
        
        agent_status = await redis_client.hget(f"{RoutingService.AGENT_PREFIX}{agent_id}", "status")
        if agent_status != "busy":
             logger.error(f"Agent status not busy: {agent_status}")
             return
        
        logger.info("✅ Call Assigned Successfully")
        logger.info("🎉 Handoff Flow Verified!")

    except Exception as e:
        logger.error(f"Test failed with exception: {e}")
    finally:
        # Cleanup
        await redis_client.delete(f"{RoutingService.CALL_PREFIX}{session_id}")
        await redis_client.zrem(f"{RoutingService.QUEUE_PREFIX}{queue_name}", session_id)
        await redis_client.close()

if __name__ == "__main__":
    asyncio.run(test_handoff_flow())
