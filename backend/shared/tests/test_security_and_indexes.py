"""
Automated Test Suite for Phase 23 (Security & Hardening) & Phase 24 (Index Optimization).
"""
import pytest
from bson import ObjectId
from fastapi import Depends, FastAPI, HTTPException
from starlette.testclient import TestClient

from shared.database.indexes import IndexManager
from shared.redis.client import redis_manager
from shared.security.dependencies import (
    assert_conversation_member,
    assert_resource_owner,
    validate_object_id,
)
from shared.security.rate_limit import require_rate_limit


def test_validate_object_id():
    """Tests NoSQL injection prevention via strict ObjectId validation."""
    valid_hex = "507f1f77bcf86cd799439011"
    oid = validate_object_id(valid_hex, "user_id")
    assert isinstance(oid, ObjectId)
    assert str(oid) == valid_hex

    # Malicious or malformed inputs must be rejected with HTTP 400
    invalid_inputs = [
        "not-a-valid-hex-id",
        "123",
        "",
        None,
        "507f1f77bcf86cd79943901Z",  # 'Z' is non-hex
        '{"$gt": ""}',
    ]
    for bad_input in invalid_inputs:
        with pytest.raises(HTTPException) as excinfo:
            validate_object_id(bad_input, "test_id")
        assert excinfo.value.status_code == 400


def test_assert_resource_owner():
    """Tests IDOR defense ownership verification."""
    user_id = "507f1f77bcf86cd799439011"

    # Matching owner passes without exception
    assert_resource_owner(user_id, user_id, "message")

    # Mismatched owner raises HTTP 403
    other_user = "507f1f77bcf86cd799439022"
    with pytest.raises(HTTPException) as excinfo:
        assert_resource_owner(user_id, other_user, "message")
    assert excinfo.value.status_code == 403
    assert "Access denied" in excinfo.value.detail


def test_assert_conversation_member():
    """Tests IDOR defense conversation membership verification."""
    user_id = "user_1"
    members = ["user_1", "user_2", "user_3"]

    # Member in list passes
    assert_conversation_member(user_id, members)

    # Non-member raises HTTP 403
    with pytest.raises(HTTPException) as excinfo:
        assert_conversation_member("user_intruder", members)
    assert excinfo.value.status_code == 403
    assert "not a member" in excinfo.value.detail


@pytest.mark.asyncio
async def test_redis_rate_limiting_dependency():
    """Tests Redis-backed rate limiting on FastAPI endpoints."""
    await redis_manager.connect()

    test_app = FastAPI()

    @test_app.get(
        "/limited-route",
        dependencies=[Depends(require_rate_limit("unit_test_route", limit=3, window_seconds=10))],
    )
    def limited_route():
        return {"success": True}

    with TestClient(test_app) as client:
        headers = {"x-forwarded-for": "10.0.0.42"}

        # 3 allowed requests
        for _ in range(3):
            resp = client.get("/limited-route", headers=headers)
            assert resp.status_code == 200

        # 4th request must be rejected with 429
        resp_4th = client.get("/limited-route", headers=headers)
        assert resp_4th.status_code == 429
        assert "retry-after" in resp_4th.headers


@pytest.mark.asyncio
async def test_in_memory_redis_expire_and_ttl():
    """Tests expire and ttl primitives on InMemoryRedis."""
    redis = redis_manager.client

    key = "test_key_ttl"
    await redis.set(key, "hello")

    assert await redis.ttl(key) == -1  # No expiration

    await redis.expire(key, 30)
    ttl = await redis.ttl(key)
    assert 0 < ttl <= 30

    await redis.delete(key)
    assert await redis.ttl(key) == -2  # Key does not exist
