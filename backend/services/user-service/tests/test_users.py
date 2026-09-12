"""
Integration and unit tests for FluxChat User Service.
Tests profile retrieval, profile updates, user discovery search, and authorization guards.
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
    """Generates a valid signed JWT access token for testing."""
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
    """Validates health check routes and Kubernetes probes."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp1 = await ac.get("/health")
        assert resp1.status_code == 200
        assert resp1.json()["status"] in ["ok", "degraded"]

        resp2 = await ac.get("/api/v1/health")
        assert resp2.status_code == 200
        assert resp2.json()["service"] == settings.APP_NAME

        # Kubernetes Probes
        live_res = await ac.get("/health/live")
        assert live_res.status_code == 200
        assert live_res.json()["status"] == "ok"
        assert "uptime_seconds" in live_res.json()

        ready_res = await ac.get("/health/ready")
        assert ready_res.status_code == 200
        assert ready_res.json()["status"] == "ok"
        assert ready_res.json()["database"] == "connected"


@pytest.mark.asyncio
async def test_unauthorized_access_rejected():
    """Protected user routes must reject requests without a valid token."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/v1/users/me")
        assert resp.status_code == 401

        resp_search = await ac.get("/api/v1/users/search?q=test")
        assert resp_search.status_code == 401


@pytest.mark.asyncio
async def test_user_profile_lifecycle_and_search():
    """
    End-to-end test:
      1. Inserts test users into MongoDB Atlas.
      2. Authenticates via JWT Bearer.
      3. Retrieves my profile.
      4. Updates profile (name, bio, avatar).
      5. Searches directory for other users.
      6. Retrieves target user's public profile.
    """
    db = db_manager.get_database()
    suffix = int(time.time() * 1000)

    # 1. Create primary test user
    user_a = {
        "name": f"Alice Tester {suffix}",
        "username": f"alice_{suffix}",
        "email": f"alice_{suffix}@example.com",
        "phone": "+919876543210",
        "bio": "Initial bio for Alice",
        "avatar": "https://example.com/alice.jpg",
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    insert_res_a = await db.users.insert_one(user_a)
    user_a_id = str(insert_res_a.inserted_id)

    # 2. Create secondary test user for search
    user_b = {
        "name": f"Bob Searchable {suffix}",
        "username": f"bob_{suffix}",
        "email": f"bob_{suffix}@example.com",
        "phone": "+919123456780",
        "bio": "Bio for Bob",
        "avatar": None,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    insert_res_b = await db.users.insert_one(user_b)
    user_b_id = str(insert_res_b.inserted_id)

    token = generate_test_token(user_a_id, user_a["email"], user_a["username"])
    headers = {"Authorization": f"Bearer {token}"}
    transport = ASGITransport(app=app)

    try:
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 3. GET /api/v1/users/me
            me_resp = await ac.get("/api/v1/users/me", headers=headers)
            assert me_resp.status_code == 200
            me_data = me_resp.json()
            assert me_data["id"] == user_a_id
            assert me_data["username"] == user_a["username"]
            assert me_data["email"] == user_a["email"]

            # 4. PATCH /api/v1/users/me
            patch_payload = {
                "name": f"Alice Updated {suffix}",
                "bio": "Updated bio via User Service API!",
                "avatar": "https://example.com/new-avatar.png",
            }
            patch_resp = await ac.patch("/api/v1/users/me", json=patch_payload, headers=headers)
            assert patch_resp.status_code == 200
            updated_data = patch_resp.json()
            assert updated_data["name"] == patch_payload["name"]
            assert updated_data["bio"] == patch_payload["bio"]
            assert updated_data["avatar"] == patch_payload["avatar"]

            # 5a. GET /api/v1/users/search?q=... (by username)
            search_resp = await ac.get(f"/api/v1/users/search?q=Bob_{suffix}", headers=headers)
            assert search_resp.status_code == 200
            search_data = search_resp.json()
            assert search_data["total"] >= 1
            found_ids = [item["id"] for item in search_data["items"]]
            assert user_b_id in found_ids
            # Ensure calling user is excluded from search results
            assert user_a_id not in found_ids

            # 5b. GET /api/v1/users/search (Empty query - lists all registered users)
            all_users_resp = await ac.get("/api/v1/users/search", headers=headers)
            assert all_users_resp.status_code == 200
            all_ids = [item["id"] for item in all_users_resp.json()["items"]]
            assert user_b_id in all_ids
            assert user_a_id not in all_ids

            # 5c. GET /api/v1/users/search?q=... (by phone number)
            phone_search_resp = await ac.get("/api/v1/users/search?q=9123456780", headers=headers)
            assert phone_search_resp.status_code == 200
            phone_ids = [item["id"] for item in phone_search_resp.json()["items"]]
            assert user_b_id in phone_ids

            # 5d. GET /api/v1/users/search?q=... (by name)
            name_search_resp = await ac.get("/api/v1/users/search?q=Bob+Searchable", headers=headers)
            assert name_search_resp.status_code == 200
            name_ids = [item["id"] for item in name_search_resp.json()["items"]]
            assert user_b_id in name_ids

            # 6. GET /api/v1/users/{user_b_id} (Public Profile)
            public_resp = await ac.get(f"/api/v1/users/{user_b_id}", headers=headers)
            assert public_resp.status_code == 200
            public_data = public_resp.json()
            assert public_data["id"] == user_b_id
            assert public_data["username"] == user_b["username"]
            # Sensitive fields like email/phone are NOT exposed in public profile
            assert "email" not in public_data

    finally:
        # Cleanup test documents
        await db.users.delete_many({"_id": {"$in": [insert_res_a.inserted_id, insert_res_b.inserted_id]}})
