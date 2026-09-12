"""
Automated tests for Phase 11 WebSocket Service.
Verifies handshake JWT authentication, socket disconnection on invalid credentials,
connection ACK, ping/pong heartbeats, presence APIs, and REST event broadcasting.
"""
from datetime import datetime, timezone
import time
from bson import ObjectId
import jwt
import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocketDisconnect
from httpx import ASGITransport, AsyncClient
from app.core.config import settings
from app.core.connection_manager import connection_manager
from app.main import app
from shared.database.mongodb import db_manager


@pytest_asyncio.fixture(autouse=True)
async def db_lifecycle():
    """Ensure database connection is active during test execution."""
    await db_manager.connect(settings.MONGODB_URL, settings.MONGODB_DATABASE)
    yield
    await db_manager.disconnect()


def generate_test_token(user_id: str, email: str, username: str) -> str:
    """Generates signed JWT access token for test client."""
    payload = {
        "sub": str(user_id),
        "email": email,
        "username": username,
        "type": "access",
        "exp": int(time.time()) + 900,
        "iat": int(time.time()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


@pytest.mark.asyncio
async def test_health_endpoints():
    """Verifies health check endpoints for WebSocket Service."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert data["database"] == "connected"
        assert "WebSocket" in data["service"]
        assert "active_connections" in data
        assert "active_users" in data


def test_websocket_unauthorized_rejected():
    """Verifies unauthenticated or invalid token connections are rejected during handshake."""
    client = TestClient(app)

    # 1. Reject missing token
    with pytest.raises(WebSocketDisconnect) as excinfo:
        with client.websocket_connect("/ws") as websocket:
            pass
    assert excinfo.value.code == 1008

    # 2. Reject malformed token
    with pytest.raises(WebSocketDisconnect) as excinfo:
        with client.websocket_connect("/ws?token=invalid.jwt.token") as websocket:
            pass
    assert excinfo.value.code == 1008


@pytest.mark.asyncio
async def test_websocket_lifecycle_and_presence():
    """Verifies authenticated connection, ACK, ping/pong, presence APIs, and broadcast."""
    db = db_manager.get_database()
    suffix = int(time.time() * 1000)

    # 1. Insert active test user in MongoDB
    user_doc = {
        "name": f"WS User {suffix}",
        "username": f"ws_user_{suffix}",
        "email": f"ws_{suffix}@test.io",
        "is_active": True,
        "is_online": False,
        "created_at": datetime.now(timezone.utc),
    }
    insert_res = await db.users.insert_one(user_doc)
    user_id = str(insert_res.inserted_id)

    try:
        token = generate_test_token(user_id, user_doc["email"], user_doc["username"])

        # 2. Connect via TestClient with lifespan context
        with TestClient(app) as client:
            with client.websocket_connect(f"/ws?token={token}") as websocket:
                # 3. Receive connection ACK
                ack_frame = websocket.receive_json()
                assert ack_frame["event"] == "connection.ack"
                assert ack_frame["data"]["user_id"] == user_id

                # 4. Exchange ping / pong
                websocket.send_json({"event": "ping", "data": {}})
                pong_frame = websocket.receive_json()
                assert pong_frame["event"] == "pong"
                assert "timestamp" in pong_frame

                # 5. Check Presence REST endpoints while connected
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as ac:
                    pres_res = await ac.get(f"/api/v1/presence/{user_id}")
                    assert pres_res.status_code == 200
                    assert pres_res.json()["is_online"] is True

                    online_res = await ac.get("/api/v1/presence/online")
                    assert online_res.status_code == 200
                    assert user_id in online_res.json()["online_users"]

                    # 6. Test REST event broadcast bridge
                    broadcast_res = await ac.post(
                        "/api/v1/events/broadcast",
                        json={
                            "event": "system.notice",
                            "data": {"text": "Server scheduled maintenance"},
                            "recipient_ids": [user_id],
                        },
                    )
                    assert broadcast_res.status_code == 200
                    assert broadcast_res.json()["status"] == "delivered"

                # 7. Verify the socket received the broadcast event
                received_broadcast = websocket.receive_json()
                assert received_broadcast["event"] == "system.notice"
                assert received_broadcast["data"]["text"] == "Server scheduled maintenance"

                # 8. Test REST event broadcast to all users
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as ac:
                    broadcast_all = await ac.post(
                        "/api/v1/events/broadcast",
                        json={
                            "event": "global.alert",
                            "data": {"message": "Global system notification"},
                        },
                    )
                    assert broadcast_all.status_code == 200

                received_global = websocket.receive_json()
                assert received_global["event"] == "global.alert"
                assert received_global["data"]["message"] == "Global system notification"

        # 9. After socket closed, verify user is disconnected
        assert connection_manager.is_user_online(user_id) is False

    finally:
        # Cleanup test user
        await db.users.delete_one({"_id": ObjectId(user_id)})
