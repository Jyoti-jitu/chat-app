"""
Automated tests for Phase 18 Notification Service.
Tests notification creation, category filtering, unread count tracking,
marking as read, dismissal, and full wipe.
"""
from datetime import datetime, timezone
import time
from bson import ObjectId
import jwt
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from app.core.config import settings
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
    """Verifies health check and probe endpoints for Notification Service."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert data["database"] == "connected"
        assert "Notification" in data["service"]

        # Service Health Probes
        live = await ac.get("/health/live")
        assert live.status_code == 200
        assert live.json()["status"] == "ok"

        ready = await ac.get("/health/ready")
        assert ready.status_code == 200
        assert ready.json()["status"] == "ok"
        assert ready.json()["database"] == "connected"


@pytest.mark.asyncio
async def test_notification_lifecycle():
    """Full lifecycle test for notifications."""
    db = db_manager.get_database()
    suffix = int(time.time() * 1000)

    # 1. Create recipient user in MongoDB
    recipient_doc = {
        "name": f"Recipient {suffix}",
        "username": f"rec_{suffix}",
        "email": f"rec_{suffix}@test.io",
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }
    r_res = await db.users.insert_one(recipient_doc)
    user_id = str(r_res.inserted_id)

    # 2. Create actor user in MongoDB
    actor_doc = {
        "name": f"Alice {suffix}",
        "username": f"alice_{suffix}",
        "email": f"alice_{suffix}@test.io",
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }
    a_res = await db.users.insert_one(actor_doc)
    actor_id = str(a_res.inserted_id)

    token = generate_test_token(user_id, recipient_doc["email"], recipient_doc["username"])
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        try:
            # 3. Initially list notifications -> empty
            list_res = await ac.get("/api/v1/notifications", headers=headers)
            assert list_res.status_code == 200
            assert list_res.json()["total"] == 0
            assert list_res.json()["unread_count"] == 0

            # 4. Create 2 notifications
            create1 = await ac.post(
                "/api/v1/notifications",
                json={
                    "user_id": user_id,
                    "actor_id": actor_id,
                    "type": "message",
                    "category": "messages",
                    "title": "New Message",
                    "description": "Hey there!",
                    "reference_id": "conv_123",
                },
            )
            assert create1.status_code == 201
            notif1_id = create1.json()["id"]

            create2 = await ac.post(
                "/api/v1/notifications",
                json={
                    "user_id": user_id,
                    "actor_id": actor_id,
                    "type": "request",
                    "category": "requests",
                    "title": "Contact Request",
                    "description": f"{actor_doc['name']} wants to connect.",
                    "reference_id": "req_456",
                },
            )
            assert create2.status_code == 201
            notif2_id = create2.json()["id"]

            # 5. List all notifications -> total: 2, unread: 2
            list_res2 = await ac.get("/api/v1/notifications", headers=headers)
            assert list_res2.status_code == 200
            assert list_res2.json()["total"] == 2
            assert list_res2.json()["unread_count"] == 2

            # 6. Filter by category
            msg_filter = await ac.get("/api/v1/notifications?category=messages", headers=headers)
            assert msg_filter.status_code == 200
            assert msg_filter.json()["total"] == 1
            assert msg_filter.json()["items"][0]["id"] == notif1_id

            # 7. Mark notif1 as read
            read_res = await ac.post(f"/api/v1/notifications/{notif1_id}/read", headers=headers)
            assert read_res.status_code == 200
            assert read_res.json()["success"] is True

            list_res3 = await ac.get("/api/v1/notifications", headers=headers)
            assert list_res3.json()["unread_count"] == 1

            # 8. Mark all as read
            read_all = await ac.post("/api/v1/notifications/read-all", headers=headers)
            assert read_all.status_code == 200
            assert read_all.json()["success"] is True

            list_res4 = await ac.get("/api/v1/notifications", headers=headers)
            assert list_res4.json()["unread_count"] == 0

            # 9. Dismiss notif1
            del_res = await ac.delete(f"/api/v1/notifications/{notif1_id}", headers=headers)
            assert del_res.status_code == 200

            list_res5 = await ac.get("/api/v1/notifications", headers=headers)
            assert list_res5.json()["total"] == 1

            # 10. Clear all
            clear_res = await ac.delete("/api/v1/notifications", headers=headers)
            assert clear_res.status_code == 200

            list_res6 = await ac.get("/api/v1/notifications", headers=headers)
            assert list_res6.json()["total"] == 0

        finally:
            # Cleanup test docs
            await db.users.delete_many({"_id": {"$in": [ObjectId(user_id), ObjectId(actor_id)]}})
            await db.notifications.delete_many({"user_id": user_id})
