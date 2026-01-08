import redis.asyncio as redis
from app.core.config import settings

# Async Redis client for caching
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

async def get(key: str):
    return await redis_client.get(key)

async def set(key: str, value: str, ex: int = None):
    await redis_client.set(key, value, ex=ex)

async def close():
    await redis_client.close()
