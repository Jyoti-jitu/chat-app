"""
Automated tests for Phase 6 Contacts Management.
Tests request creation, self-request rejection, duplicate detection,
accept/reject lifecycle, contact roster population, and contact deletion.
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
async def test_contacts_lifecycle():
    """Complete end-to-end contacts and connection requests test."""
    db = db_manager.get_database()
    suffix = int(time.time() * 1000)

    # 1. Create two test users in MongoDB
    user_a = {
        "name": f"User Alpha {suffix}",
        "username": f"alpha_{suffix}",
        "email": f"alpha_{suffix}@example.com",
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }
    insert_a = await db.users.insert_one(user_a)
    user_a_id = str(insert_a.inserted_id)

    user_b = {
        "name": f"User Beta {suffix}",
        "username": f"beta_{suffix}",
        "email": f"beta_{suffix}@example.com",
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }
    insert_b = await db.users.insert_one(user_b)
    user_b_id = str(insert_b.inserted_id)

    token_a = generate_test_token(user_a_id, user_a["email"], user_a["username"])
    token_b = generate_test_token(user_b_id, user_b["email"], user_b["username"])
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    transport = ASGITransport(app=app)

    try:
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 2. Self request fails (400)
            self_resp = await ac.post(
                "/api/v1/contacts/requests",
                json={"recipient_id": user_a_id},
                headers=headers_a,
            )
            assert self_resp.status_code == 400

            # 3. User A sends request to User B by username identifier (201)
            send_resp = await ac.post(
                "/api/v1/contacts/requests",
                json={"identifier": user_b["username"]},
                headers=headers_a,
            )
            assert send_resp.status_code == 201
            req_data = send_resp.json()
            assert req_data["recipient_id"] == user_b_id
            assert req_data["status"] == "pending"
            request_id = req_data["id"]

            # 4. Duplicate request fails (400)
            dup_resp = await ac.post(
                "/api/v1/contacts/requests",
                json={"recipient_id": user_b_id},
                headers=headers_a,
            )
            assert dup_resp.status_code == 400

            # 5. Check request lists
            # User A has it in sent
            list_a = await ac.get("/api/v1/contacts/requests", headers=headers_a)
            assert list_a.status_code == 200
            assert any(r["id"] == request_id for r in list_a.json()["sent"])

            # User B has it in received
            list_b = await ac.get("/api/v1/contacts/requests", headers=headers_b)
            assert list_b.status_code == 200
            assert any(r["id"] == request_id for r in list_b.json()["received"])

            # 6. User A cannot accept their own sent request (403)
            bad_accept = await ac.post(
                f"/api/v1/contacts/requests/{request_id}/accept",
                headers=headers_a,
            )
            assert bad_accept.status_code == 403

            # 7. User B accepts the request (200)
            accept_resp = await ac.post(
                f"/api/v1/contacts/requests/{request_id}/accept",
                headers=headers_b,
            )
            assert accept_resp.status_code == 200

            # 8. Verify contacts roster is bidirectional
            roster_a = await ac.get("/api/v1/contacts", headers=headers_a)
            assert roster_a.status_code == 200
            assert any(c["contact_id"] == user_b_id for c in roster_a.json()["items"])

            roster_b = await ac.get("/api/v1/contacts", headers=headers_b)
            assert roster_b.status_code == 200
            assert any(c["contact_id"] == user_a_id for c in roster_b.json()["items"])

            # 9. Cannot send request if already connected (400)
            again_resp = await ac.post(
                "/api/v1/contacts/requests",
                json={"recipient_id": user_b_id},
                headers=headers_a,
            )
            assert again_resp.status_code == 400

            # 10. Delete contact removes bidirectional link
            del_resp = await ac.delete(f"/api/v1/contacts/{user_b_id}", headers=headers_a)
            assert del_resp.status_code == 200

            # Verify removed from rosters
            after_a = await ac.get("/api/v1/contacts", headers=headers_a)
            assert not any(c["contact_id"] == user_b_id for c in after_a.json()["items"])
            after_b = await ac.get("/api/v1/contacts", headers=headers_b)
            assert not any(c["contact_id"] == user_a_id for c in after_b.json()["items"])

    finally:
        # Cleanup
        await db.users.delete_many({"_id": {"$in": [insert_a.inserted_id, insert_b.inserted_id]}})
        await db.contact_requests.delete_many(
            {"$or": [{"sender_id": user_a_id}, {"recipient_id": user_a_id}]}
        )
        await db.contacts.delete_many(
            {"$or": [{"user_id": user_a_id}, {"contact_id": user_a_id}]}
        )
