"""
Automated tests for Phase 7 Chat & Conversation Service.
Tests 1:1 direct chat creation, deduplication, group chat lifecycle,
membership authorization guards, and member addition/removal.
"""
from datetime import datetime, timezone
import time
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
    """Verifies health check endpoints for Chat Service."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert data["database"] == "connected"
        assert "FluxChat" in data["service"]


@pytest.mark.asyncio
async def test_conversation_lifecycle():
    """Tests direct chat deduplication, group creation, member management, and leaving."""
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

    direct_conv_id = None
    group_id = None

    transport = ASGITransport(app=app)

    try:
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 2. Cannot create direct conversation with oneself
            self_res = await ac.post(
                "/api/v1/conversations/direct",
                json={"recipient_id": user_a_id},
                headers=headers_a,
            )
            assert self_res.status_code == 400

            # 3. Create direct conversation between Alice and Bob
            direct_res = await ac.post(
                "/api/v1/conversations/direct",
                json={"recipient_id": user_b_id},
                headers=headers_a,
            )
            assert direct_res.status_code == 200
            direct_data = direct_res.json()
            direct_conv_id = direct_data["id"]
            assert direct_data["type"] == "direct"
            assert user_a_id in direct_data["member_ids"]
            assert user_b_id in direct_data["member_ids"]
            # From Alice's view, direct chat title displays Bob's name
            assert direct_data["name"] == users_data[1]["name"]

            # 4. Deduplication: calling again (even from Bob's side) returns identical conversation
            dedup_res = await ac.post(
                "/api/v1/conversations/direct",
                json={"recipient_id": user_a_id},
                headers=headers_b,
            )
            assert dedup_res.status_code == 200
            assert dedup_res.json()["id"] == direct_conv_id

            # 5. Create group conversation
            group_res = await ac.post(
                "/api/v1/conversations/group",
                json={
                    "name": "Design Squad",
                    "member_ids": [user_b_id],
                },
                headers=headers_a,
            )
            assert group_res.status_code == 201
            group_data = group_res.json()
            group_id = group_data["id"]
            assert group_data["type"] == "group"
            assert group_data["name"] == "Design Squad"
            assert user_a_id in group_data["admins"]

            # 6. List conversations for Alice (should have 2 items)
            list_res = await ac.get("/api/v1/conversations", headers=headers_a)
            assert list_res.status_code == 200
            list_data = list_res.json()
            conv_ids = [c["id"] for c in list_data["items"]]
            assert direct_conv_id in conv_ids
            assert group_id in conv_ids

            # 7. Add Charlie to group
            add_res = await ac.post(
                f"/api/v1/conversations/{group_id}/members",
                json={"member_ids": [user_c_id]},
                headers=headers_a,
            )
            assert add_res.status_code == 200
            assert user_c_id in add_res.json()["member_ids"]

            # 8. Non-admin (Bob) cannot remove members (403)
            bad_remove = await ac.delete(
                f"/api/v1/conversations/{group_id}/members/{user_c_id}",
                headers=headers_b,
            )
            assert bad_remove.status_code == 403

            # 9. Admin (Alice) removes Charlie
            remove_res = await ac.delete(
                f"/api/v1/conversations/{group_id}/members/{user_c_id}",
                headers=headers_a,
            )
            assert remove_res.status_code == 200
            assert user_c_id not in remove_res.json()["member_ids"]

            # 10. Bob voluntarily leaves the group
            leave_res = await ac.post(
                f"/api/v1/conversations/{group_id}/leave",
                headers=headers_b,
            )
            assert leave_res.status_code == 200

            # Verify Bob is no longer in group members
            after_leave = await ac.get(
                f"/api/v1/conversations/{group_id}",
                headers=headers_a,
            )
            assert user_b_id not in after_leave.json()["member_ids"]

    finally:
        # Cleanup
        await db.users.delete_many({"_id": {"$in": list(inserted.inserted_ids)}})
        clean_conv_ids = [cid for cid in [direct_conv_id, group_id] if cid is not None]
        if clean_conv_ids:
            from bson import ObjectId
            oids = []
            for cid in clean_conv_ids:
                try:
                    oids.append(ObjectId(cid))
                except Exception:
                    pass
            await db.conversations.delete_many(
                {"$or": [{"_id": {"$in": oids}}, {"_id": {"$in": clean_conv_ids}}]}
            )
