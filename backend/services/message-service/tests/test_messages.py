"""
Automated tests for Phase 8 Message Service.
Tests message creation, IDOR membership validation, author-only editing,
soft deletion, status transitions, and conversation synchronization.
"""
from datetime import datetime, timezone
import time
from bson import ObjectId
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
import jwt
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
    """Verifies health check endpoints for Message Service."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert data["database"] == "connected"
        assert "FluxChat" in data["service"]


@pytest.mark.asyncio
async def test_message_lifecycle():
    """Complete message persistence, editing, soft deletion, and membership security test."""
    db = db_manager.get_database()
    suffix = int(time.time() * 1000)

    # 1. Create three test users in MongoDB
    users_data = [
        {"name": f"Alice {suffix}", "username": f"alice_{suffix}", "email": f"alice_{suffix}@test.io", "is_active": True, "created_at": datetime.now(timezone.utc)},
        {"name": f"Bob {suffix}", "username": f"bob_{suffix}", "email": f"bob_{suffix}@test.io", "is_active": True, "created_at": datetime.now(timezone.utc)},
        {"name": f"Charlie {suffix}", "username": f"charlie_{suffix}", "email": f"charlie_{suffix}@test.io", "is_active": True, "created_at": datetime.now(timezone.utc)},
    ]
    inserted = await db.users.insert_many(users_data)
    user_a_id = str(inserted.inserted_ids[0])
    user_b_id = str(inserted.inserted_ids[1])
    user_c_id = str(inserted.inserted_ids[2])

    token_a = generate_test_token(user_a_id, users_data[0]["email"], users_data[0]["username"])
    token_b = generate_test_token(user_b_id, users_data[1]["email"], users_data[1]["username"])
    token_c = generate_test_token(user_c_id, users_data[2]["email"], users_data[2]["username"])

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    headers_c = {"Authorization": f"Bearer {token_c}"}

    # 2. Create conversation between Alice and Bob
    conv_data = {
        "type": "direct",
        "members": [user_a_id, user_b_id],
        "admins": [user_a_id, user_b_id],
        "created_by": user_a_id,
        "unread_count": 0,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    inserted_conv = await db.conversations.insert_one(conv_data)
    conv_id = str(inserted_conv.inserted_id)

    msg_id = None
    transport = ASGITransport(app=app)

    try:
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 3. Charlie (not in conversation) cannot send message (403)
            bad_send = await ac.post(
                f"/api/v1/conversations/{conv_id}/messages",
                json={"content": "I am an eavesdropper!", "type": "text"},
                headers=headers_c,
            )
            assert bad_send.status_code == 403

            # 4. Charlie cannot view messages (403)
            bad_list = await ac.get(
                f"/api/v1/conversations/{conv_id}/messages",
                headers=headers_c,
            )
            assert bad_list.status_code == 403

            # 5. Alice sends message to Bob (201)
            send_res = await ac.post(
                f"/api/v1/conversations/{conv_id}/messages",
                json={"content": "Hello Bob! Welcome to FluxChat.", "type": "text"},
                headers=headers_a,
            )
            assert send_res.status_code == 201
            msg_data = send_res.json()
            msg_id = msg_data["id"]
            assert msg_data["content"] == "Hello Bob! Welcome to FluxChat."
            assert msg_data["sender_id"] == user_a_id
            assert msg_data["status"] == "sent"
            assert msg_data["edited"] is False
            assert msg_data["deleted"] is False

            # 6. Verify conversation's last_message is updated
            conv_doc = await db.conversations.find_one({"_id": ObjectId(conv_id)})
            assert conv_doc["last_message"]["content"] == "Hello Bob! Welcome to FluxChat."

            # 7. Bob retrieves messages in conversation (200)
            list_res = await ac.get(
                f"/api/v1/conversations/{conv_id}/messages",
                headers=headers_b,
            )
            assert list_res.status_code == 200
            thread = list_res.json()["items"]
            assert len(thread) == 1
            assert thread[0]["id"] == msg_id

            # 8. Bob cannot edit Alice's message (403)
            bad_edit = await ac.patch(
                f"/api/v1/messages/{msg_id}",
                json={"content": "Impersonated edit"},
                headers=headers_b,
            )
            assert bad_edit.status_code == 403

            # 9. Alice edits her message (200)
            edit_res = await ac.patch(
                f"/api/v1/messages/{msg_id}",
                json={"content": "Hello Bob! Welcome to FluxChat. (edited)"},
                headers=headers_a,
            )
            assert edit_res.status_code == 200
            assert edit_res.json()["content"] == "Hello Bob! Welcome to FluxChat. (edited)"
            assert edit_res.json()["edited"] is True

            # 10. Bob cannot delete Alice's message (403)
            bad_del = await ac.delete(
                f"/api/v1/messages/{msg_id}",
                headers=headers_b,
            )
            assert bad_del.status_code == 403

            # 11. Alice soft deletes her message (200)
            del_res = await ac.delete(
                f"/api/v1/messages/{msg_id}",
                headers=headers_a,
            )
            assert del_res.status_code == 200
            assert del_res.json()["deleted"] is True
            assert del_res.json()["content"] == "This message was deleted"

            # 12. Cannot edit a deleted message (400)
            deleted_edit = await ac.patch(
                f"/api/v1/messages/{msg_id}",
                json={"content": "Reviving message"},
                headers=headers_a,
            )
            assert deleted_edit.status_code == 400

            # 13. Bob marks message as read (200)
            read_res = await ac.post(
                f"/api/v1/messages/{msg_id}/read",
                headers=headers_b,
            )
            assert read_res.status_code == 200
            assert read_res.json()["status"] == "read"

    finally:
        # Cleanup
        await db.users.delete_many({"_id": {"$in": list(inserted.inserted_ids)}})
        await db.conversations.delete_one({"_id": ObjectId(conv_id)})
        if msg_id:
            await db.messages.delete_many({"conversation_id": conv_id})
