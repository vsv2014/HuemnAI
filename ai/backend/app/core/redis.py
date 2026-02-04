import redis.asyncio as redis
from app.core.config import settings

# Global Redis client instance
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

async def get_redis():
    """
    Get the global Redis client instance.
    """
    return redis_client

async def close_redis():
    """
    Close the Redis connection.
    """
    await redis_client.close()
