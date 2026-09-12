"""
Async Redis Client & In-Memory Fallback Manager for FluxChat.
Provides high-performance distributed Pub/Sub and KV caching with automatic
transparent in-memory fallback when an external Redis server is unavailable.
"""
import asyncio
import json
import logging
import os
import time
from typing import Any, AsyncGenerator, Dict, List, Optional, Set

try:
    import redis.asyncio as aioredis
    HAS_AIOREDIS = True
except ImportError:
    HAS_AIOREDIS = False

logger = logging.getLogger("FluxChat.Shared.Redis")


class InMemoryPubSub:
    """Async In-Memory Pub/Sub channel implementation for local development and testing."""

    def __init__(self, manager: "InMemoryRedis"):
        self.manager = manager
        self.channels: Set[str] = set()
        self.queue: asyncio.Queue = asyncio.Queue()

    async def subscribe(self, *channels: str):
        for ch in channels:
            self.channels.add(ch)
            if ch not in self.manager._subscribers:
                self.manager._subscribers[ch] = set()
            self.manager._subscribers[ch].add(self.queue)

    async def unsubscribe(self, *channels: str):
        for ch in channels:
            self.channels.discard(ch)
            if ch in self.manager._subscribers:
                self.manager._subscribers[ch].discard(self.queue)

    async def listen(self) -> AsyncGenerator[Dict[str, Any], None]:
        while True:
            msg = await self.queue.get()
            yield msg

    async def close(self):
        for ch in list(self.channels):
            if ch in self.manager._subscribers:
                self.manager._subscribers[ch].discard(self.queue)
        self.channels.clear()


class InMemoryRedis:
    """In-memory key-value cache and Pub/Sub router matching redis-py async semantics."""

    def __init__(self):
        self._kv: Dict[str, str] = {}
        self._expiry: Dict[str, float] = {}
        self._sets: Dict[str, Set[str]] = {}
        self._subscribers: Dict[str, Set[asyncio.Queue]] = {}
        self._lock = asyncio.Lock()

    def _purge_expired(self, key: str):
        if key in self._expiry and time.time() > self._expiry[key]:
            self._kv.pop(key, None)
            self._expiry.pop(key, None)
            self._sets.pop(key, None)

    async def set(self, key: str, value: Any, ex: Optional[int] = None) -> bool:
        async with self._lock:
            val_str = str(value) if not isinstance(value, str) else value
            self._kv[key] = val_str
            if ex:
                self._expiry[key] = time.time() + ex
            elif key in self._expiry:
                del self._expiry[key]
            return True

    async def get(self, key: str) -> Optional[str]:
        async with self._lock:
            self._purge_expired(key)
            return self._kv.get(key)

    async def delete(self, *keys: str) -> int:
        async with self._lock:
            count = 0
            for k in keys:
                if k in self._kv or k in self._sets:
                    count += 1
                self._kv.pop(k, None)
                self._expiry.pop(k, None)
                self._sets.pop(k, None)
            return count

    async def incr(self, key: str, amount: int = 1) -> int:
        async with self._lock:
            self._purge_expired(key)
            current = int(self._kv.get(key, 0))
            new_val = current + amount
            self._kv[key] = str(new_val)
            return new_val

    async def decr(self, key: str, amount: int = 1) -> int:
        return await self.incr(key, -amount)

    async def sadd(self, key: str, *members: str) -> int:
        async with self._lock:
            self._purge_expired(key)
            if key not in self._sets:
                self._sets[key] = set()
            added = 0
            for m in members:
                if m not in self._sets[key]:
                    self._sets[key].add(str(m))
                    added += 1
            return added

    async def srem(self, key: str, *members: str) -> int:
        async with self._lock:
            self._purge_expired(key)
            if key not in self._sets:
                return 0
            removed = 0
            for m in members:
                if str(m) in self._sets[key]:
                    self._sets[key].remove(str(m))
                    removed += 1
            return removed

    async def smembers(self, key: str) -> Set[str]:
        async with self._lock:
            self._purge_expired(key)
            return set(self._sets.get(key, set()))

    async def publish(self, channel: str, message: Any) -> int:
        data = message if isinstance(message, str) else json.dumps(message)
        subscribers = list(self._subscribers.get(channel, set()))
        frame = {
            "type": "message",
            "pattern": None,
            "channel": channel,
            "data": data,
        }
        for q in subscribers:
            await q.put(frame)
        return len(subscribers)

    async def expire(self, key: str, seconds: int) -> bool:
        async with self._lock:
            if key in self._kv or key in self._sets:
                self._expiry[key] = time.time() + seconds
                return True
            return False

    async def ttl(self, key: str) -> int:
        async with self._lock:
            self._purge_expired(key)
            if key not in self._kv and key not in self._sets:
                return -2
            if key not in self._expiry:
                return -1
            remaining = int(self._expiry[key] - time.time())
            return max(0, remaining)

    def pubsub(self) -> InMemoryPubSub:
        return InMemoryPubSub(self)

    async def ping(self) -> bool:
        return True

    async def close(self):
        pass



class RedisManager:
    """Manages Redis connection lifecycle with resilient in-memory fallback."""

    def __init__(self):
        self._client: Optional[Any] = None
        self._is_real_redis: bool = False
        self._in_memory: Optional[InMemoryRedis] = None

    async def connect(self, redis_url: Optional[str] = None) -> bool:
        """
        Connects to Redis server. If unavailable, initializes In-Memory fallback.
        """
        url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379/0")

        if HAS_AIOREDIS and url:
            try:
                client = aioredis.from_url(
                    url,
                    decode_responses=True,
                    socket_connect_timeout=1.5,
                )
                await client.ping()
                self._client = client
                self._is_real_redis = True
                logger.info(f"Connected to Redis server at [{url}].")
                return True
            except Exception as e:
                logger.info(
                    f"External Redis server not detected ({e}). Using robust In-Memory Pub/Sub & Cache engine."
                )

        self._in_memory = InMemoryRedis()
        self._client = self._in_memory
        self._is_real_redis = False
        return True

    @property
    def client(self) -> Any:
        if self._client is None:
            self._in_memory = InMemoryRedis()
            self._client = self._in_memory
        return self._client

    @property
    def is_real_redis(self) -> bool:
        return self._is_real_redis

    async def publish(self, channel: str, message: Any) -> int:
        """Publishes a payload to a channel."""
        data = message if isinstance(message, str) else json.dumps(message)
        return await self.client.publish(channel, data)

    def pubsub(self):
        """Returns a PubSub instance."""
        return self.client.pubsub()

    async def set(self, key: str, value: Any, ex: Optional[int] = None) -> bool:
        return await self.client.set(key, value, ex=ex)

    async def get(self, key: str) -> Optional[str]:
        return await self.client.get(key)

    async def delete(self, *keys: str) -> int:
        return await self.client.delete(*keys)

    async def incr(self, key: str, amount: int = 1) -> int:
        return await self.client.incr(key, amount)

    async def decr(self, key: str, amount: int = 1) -> int:
        if hasattr(self.client, "decr"):
            return await self.client.decr(key, amount)
        return await self.client.incr(key, -amount)

    async def sadd(self, key: str, *members: str) -> int:
        return await self.client.sadd(key, *members)

    async def srem(self, key: str, *members: str) -> int:
        return await self.client.srem(key, *members)

    async def smembers(self, key: str) -> Set[str]:
        res = await self.client.smembers(key)
        return set(res) if res else set()

    async def is_connected(self) -> bool:
        """Verifies if Redis connection or in-memory fallback is active and pingable."""
        if self._client is None:
            try:
                await self.connect()
            except Exception:
                pass
        if self._client is None:
            return False
        try:
            if hasattr(self._client, "ping"):
                res = await self._client.ping()
                return bool(res)
            return True
        except Exception:
            return False


    async def disconnect(self):
        """Closes Redis connections."""
        if self._client and hasattr(self._client, "close"):
            await self._client.close()
        self._client = None
        self._in_memory = None



redis_manager = RedisManager()
