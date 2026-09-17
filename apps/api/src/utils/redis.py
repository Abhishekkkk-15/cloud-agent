import redis
from src.utils.config import config

if not config.redis_uri:
    raise Exception("Redis URI is not set")

redis_client = redis.Redis().from_url(config.redis_uri,decode_responses=True)

