import asyncio
import json
import logging
from typing import Dict, Any
from app.core.redis import redis_client
from app.services.socket_manager import manager

logger = logging.getLogger(__name__)

CHANNEL_CRM = "events:crm"

async def publish(topic: str, payload: Dict[str, Any]):
    try:
        await redis_client.publish(topic, json.dumps(payload))
    except Exception as e:
        logger.error(f"Event publish failed: {e}")
        try:
            await manager.broadcast(json.dumps(payload))
        except Exception as e2:
            logger.error(f"Event direct broadcast failed: {e2}")

async def start_forwarder():
    try:
        ps = redis_client.pubsub()
        await ps.subscribe(CHANNEL_CRM)
        logger.info("Event forwarder subscribed to Redis channels")
        async for message in ps.listen():
            if message and message.get("type") == "message":
                data = message.get("data")
                try:
                    await manager.broadcast(data if isinstance(data, str) else json.dumps(data))
                except Exception as e:
                    logger.warning(f"Broadcast failed: {e}")
    except Exception as e:
        logger.error(f"Event forwarder error: {e}")
