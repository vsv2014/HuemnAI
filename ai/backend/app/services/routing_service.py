import json
import logging
import os
import time
from typing import Optional, List, Dict, Any, Tuple
from app.core.redis import redis_client
from app.schemas.node_configs import HandoffNodeConfig

logger = logging.getLogger(__name__)

class RoutingService:
    QUEUE_PREFIX = "queue:"
    AGENT_PREFIX = "agent:"
    CALL_PREFIX = "call:"
    ONLINE_AGENTS_SET = "agents:online"
    
    @staticmethod
    async def enqueue_call(
        session_id: str,
        node_config: HandoffNodeConfig,
        context: Dict[str, Any]
    ) -> bool:
        """
        Enqueue a call for agent routing.
        """
        queue_name = f"{RoutingService.QUEUE_PREFIX}{node_config.queue_name}"
        priority = node_config.priority
        
        # Prepare call data
        call_data = {
            "session_id": session_id,
            "queue_name": node_config.queue_name,
            "timestamp": time.time(),
            "priority": priority,
            "required_skills": json.dumps(node_config.required_skills),
            "context": json.dumps(context),
            "handoff_message": node_config.handoff_message,
            "timeout_seconds": node_config.timeout_seconds,
            "timeout_action": node_config.timeout_action,
            "status": "queued"
        }
        
        try:
            # 1. Store call details
            await redis_client.hset(f"{RoutingService.CALL_PREFIX}{session_id}", mapping=call_data)
            
            # 2. Add to priority queue (ZSET)
            # Score = -priority (so higher priority comes first)
            # We can also add timestamp fraction to preserve FIFO for same priority
            # score = -priority + (timestamp / 10000000000)
            score = -priority 
            await redis_client.zadd(queue_name, {session_id: score})
            
            logger.info(f"Enqueued call {session_id} to {node_config.queue_name} with priority {priority}")
            
            # 3. Trigger immediate matching attempt (could be background task)
            # For now, we just return True, assuming a worker or the agent polling will pick it up.
            # But strictly, we might want to try to match immediately.
            return True
        except Exception as e:
            logger.error(f"Failed to enqueue call {session_id}: {e}")
            return False

    @staticmethod
    async def get_call_data(session_id: str) -> Optional[Dict[str, Any]]:
        try:
            call_key = f"{RoutingService.CALL_PREFIX}{session_id}"
            call_data = await redis_client.hgetall(call_key)
            if not call_data:
                return None
            if "context" in call_data:
                try:
                    call_data["context"] = json.loads(call_data["context"])
                except:
                    pass
            if "required_skills" in call_data:
                try:
                    call_data["required_skills"] = json.loads(call_data["required_skills"])
                except:
                    pass
            return call_data
        except Exception as e:
            logger.error(f"Failed to load call data {session_id}: {e}")
            return None

    @staticmethod
    async def register_agent_presence(agent_id: str, status: str, skills: List[str], queues: List[str]):
        """
        Update agent presence and skills in Redis.
        """
        try:
            key = f"{RoutingService.AGENT_PREFIX}{agent_id}"
            data = {
                "status": status,
                "skills": json.dumps(skills),
                "queues": json.dumps(queues),
                "last_heartbeat": time.time()
            }
            await redis_client.hset(key, mapping=data)
            await redis_client.expire(key, 60)  # TTL for crash handling
            
            if status == "online":
                await redis_client.sadd(RoutingService.ONLINE_AGENTS_SET, agent_id)
            else:
                await redis_client.srem(RoutingService.ONLINE_AGENTS_SET, agent_id)
                
            logger.debug(f"Updated presence for agent {agent_id}: {status}")
        except Exception as e:
            logger.error(f"Failed to update agent presence: {e}")
            raise


    @staticmethod
    async def find_best_agent_for_call(session_id: str) -> Optional[str]:
        """
        Find the best available agent for a specific queued call.
        """
        try:
            # Get call details
            call_key = f"{RoutingService.CALL_PREFIX}{session_id}"
            call_data = await redis_client.hgetall(call_key)
            if not call_data:
                return None
            
            required_skills = json.loads(call_data.get("required_skills", "[]"))
            queue_name = call_data.get("queue_name")
            
            # Get all online agents
            online_agent_ids = await redis_client.smembers(RoutingService.ONLINE_AGENTS_SET)
            
            best_agent = None
            
            for agent_id in online_agent_ids:
                agent_key = f"{RoutingService.AGENT_PREFIX}{agent_id}"
                agent_data = await redis_client.hgetall(agent_key)
                
                if not agent_data:
                    continue
                
                # Check status
                if agent_data.get("status") != "online":
                    continue
                    
                # Check queues
                agent_queues = json.loads(agent_data.get("queues", "[]"))
                if queue_name not in agent_queues and "all" not in agent_queues:
                    continue
                
                # Check skills
                agent_skills = set(json.loads(agent_data.get("skills", "[]")))
                if required_skills:
                    req_skills_set = set(required_skills)
                    if not req_skills_set.issubset(agent_skills):
                        continue
                
                # Found a match! (Simple first-match logic for now, can be improved to least-loaded)
                best_agent = agent_id
                break
            
            return best_agent
            
        except Exception as e:
            logger.error(f"Error finding agent for call {session_id}: {e}")
            return None

    @staticmethod
    async def assign_call(session_id: str, agent_id: str) -> bool:
        """
        Assign a call to an agent.
        """
        try:
            # 1. Update call status
            call_key = f"{RoutingService.CALL_PREFIX}{session_id}"
            
            # Fetch call data first to check for IVR SID
            call_data = await redis_client.hgetall(call_key)
            if not call_data:
                logger.error(f"Call {session_id} not found")
                return False
            existing_status = call_data.get("status")
            existing_agent = call_data.get("agent_id")
            if existing_status == "assigned":
                if existing_agent == agent_id:
                    return True
                logger.info(f"Call {session_id} already assigned to {existing_agent}")
                return False
                
            await redis_client.hset(call_key, mapping={"status": "assigned", "agent_id": agent_id, "assigned_at": time.time()})
            
            # 2. Update agent status to busy
            agent_key = f"{RoutingService.AGENT_PREFIX}{agent_id}"
            await redis_client.hset(agent_key, mapping={"status": "busy"})
            
            # 3. Remove from queue
            queue_name = call_data.get("queue_name")
            if queue_name:
                 await redis_client.zrem(f"{RoutingService.QUEUE_PREFIX}{queue_name}", session_id)
            
            # 4. Bridge Voice Call if IVR SID exists
            # We need to bridge the queued call to the Agent's Client Device
            # The agent's client identity is their agent_id (or we need to map it)
            context_str = call_data.get("context", "{}")
            try:
                context = json.loads(context_str)
                ivr_call_sid = context.get("ivr_call_sid") or context.get("call_sid")
                voice_masking = bool(context.get("voice_masking"))
                
                if ivr_call_sid:
                    from app.services.telephony_service import telephony_service
                    if voice_masking:
                        api_base = os.getenv('API_BASE_URL', 'http://localhost:8001')
                        url = f"{api_base}/api/ivr/call-handler?agent_id={agent_id}&session_id={session_id}&mode=agent"
                        logger.info(f"Redirecting call {ivr_call_sid} to masked agent flow for {agent_id}")
                        telephony_service.redirect_call(ivr_call_sid, url)
                    else:
                        logger.info(f"Bridging call {ivr_call_sid} to agent {agent_id}")
                        telephony_service.bridge_to_client(ivr_call_sid, agent_id, parameters={"session_id": session_id}, record=True)
            except Exception as e:
                logger.error(f"Failed to bridge voice call: {e}")
            
            logger.info(f"Assigned call {session_id} to agent {agent_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to assign call {session_id} to {agent_id}: {e}")
            raise

    @staticmethod
    async def get_queue_stats() -> Dict[str, Any]:
        """
        Get statistics for all queues.
        """
        try:
            # List all queues (scan queue:*)
            cursor = 0
            queues = {}
            while True:
                cursor, keys = await redis_client.scan(cursor, match=f"{RoutingService.QUEUE_PREFIX}*", count=100)
                for key in keys:
                    queue_name = key.replace(RoutingService.QUEUE_PREFIX, "")
                    count = await redis_client.zcard(key)
                    queues[queue_name] = count
                if cursor == 0:
                    break
            return queues
        except Exception as e:
            logger.error(f"Failed to get queue stats: {e}")
            raise

    @staticmethod
    async def get_queued_calls(queue_name: str = None) -> List[Dict[str, Any]]:
        """
        Get detailed list of queued calls.
        If queue_name is provided, fetch only for that queue.
        Otherwise fetch for all queues.
        """
        try:
            calls = []
            queue_keys = []
            
            if queue_name:
                queue_keys = [f"{RoutingService.QUEUE_PREFIX}{queue_name}"]
            else:
                # Scan for all queues
                cursor = 0
                while True:
                    cursor, keys = await redis_client.scan(cursor, match=f"{RoutingService.QUEUE_PREFIX}*", count=100)
                    queue_keys.extend(keys)
                    if cursor == 0:
                        break
            
            for q_key in queue_keys:
                # Get all session_ids in the queue (sorted by priority/score)
                session_ids = await redis_client.zrange(q_key, 0, -1)
                
                for sid in session_ids:
                    call_key = f"{RoutingService.CALL_PREFIX}{sid}"
                    call_data = await redis_client.hgetall(call_key)
                    if call_data:
                        # Parse JSON fields
                        if "context" in call_data:
                            try:
                                call_data["context"] = json.loads(call_data["context"])
                            except:
                                pass
                        if "required_skills" in call_data:
                            try:
                                call_data["required_skills"] = json.loads(call_data["required_skills"])
                            except:
                                pass
                        
                        # Calculate wait time
                        if "timestamp" in call_data:
                            call_data["wait_time"] = time.time() - float(call_data["timestamp"])
                            
                        calls.append(call_data)
                        
            return calls
        except Exception as e:
            logger.error(f"Failed to get queued calls: {e}")
            raise
