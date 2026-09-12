"""
Unit tests for Shared Redis Manager and Pub/Sub Fallback.
Verifies KV caching, set operations, and pub/sub message routing.
"""
import asyncio
import json
import pytest
from shared.redis.client import redis_manager, InMemoryRedis


@pytest.mark.asyncio
async def test_redis_kv_operations():
    """Verifies basic key-value operations and TTL."""
    await redis_manager.connect()

    # Set & Get
    await redis_manager.set("test_key", "test_value")
    val = await redis_manager.get("test_key")
    assert val == "test_value"

    # Incr & Decr
    await redis_manager.set("counter", 10)
    new_val = await redis_manager.incr("counter")
    assert new_val == 11
    new_val = await redis_manager.decr("counter", 2)
    assert new_val == 9

    # Expiry
    await redis_manager.set("ephemeral", "hello", ex=1)
    assert await redis_manager.get("ephemeral") == "hello"
    await asyncio.sleep(1.1)
    assert await redis_manager.get("ephemeral") is None

    # Delete
    await redis_manager.set("to_delete", "val")
    deleted = await redis_manager.delete("to_delete")
    assert deleted == 1
    assert await redis_manager.get("to_delete") is None


@pytest.mark.asyncio
async def test_redis_set_operations():
    """Verifies Redis set operations for presence rosters."""
    await redis_manager.connect()

    await redis_manager.sadd("online_users", "user_1", "user_2")
    members = await redis_manager.smembers("online_users")
    assert "user_1" in members
    assert "user_2" in members

    await redis_manager.srem("online_users", "user_1")
    members = await redis_manager.smembers("online_users")
    assert "user_1" not in members
    assert "user_2" in members


@pytest.mark.asyncio
async def test_redis_pub_sub():
    """Verifies async Pub/Sub message publishing and reception."""
    await redis_manager.connect()

    ps = redis_manager.pubsub()
    await ps.subscribe("conversation:conv_123")

    # Publish message in background task
    async def publish_after_delay():
        await asyncio.sleep(0.05)
        await redis_manager.publish(
            "conversation:conv_123",
            {"event": "message.new", "text": "Hello Redis!"},
        )

    asyncio.create_task(publish_after_delay())

    # Listen for message
    async for message in ps.listen():
        assert message["channel"] == "conversation:conv_123"
        data = json.loads(message["data"]) if isinstance(message["data"], str) else message["data"]
        assert data["event"] == "message.new"
        assert data["text"] == "Hello Redis!"
        break

    await ps.close()
