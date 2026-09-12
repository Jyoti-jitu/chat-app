"""
End-to-End Cross-Service Integration Test Suite (Phase 25).
Exercises the complete user lifecycle traversing the API Gateway on port 8000.
"""
import asyncio
import json
import time
from typing import Dict
from bson import ObjectId
import certifi
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
import pytest
import websockets

import os
from pathlib import Path
from dotenv import load_dotenv

# Load backend/.env if present
test_dir = Path(__file__).resolve().parent
backend_dir = test_dir.parent.parent
for env_candidate in [backend_dir / ".env", backend_dir / "services/auth-service/.env", Path(".env")]:
    if env_candidate.exists():
        load_dotenv(env_candidate, override=True)
        break

GATEWAY_HTTP_URL = os.getenv("GATEWAY_HTTP_URL", "http://127.0.0.1:8000")
GATEWAY_WS_URL = os.getenv("GATEWAY_WS_URL", "ws://127.0.0.1:8000/ws")
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")


@pytest.mark.asyncio
async def test_e2e_cluster_health():
    """Verifies that the API Gateway aggregates health status across all 6 services."""
    async with httpx.AsyncClient(base_url=GATEWAY_HTTP_URL, timeout=10.0) as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        services = data["services"]
        for svc in [
            "auth-service",
            "user-service",
            "chat-service",
            "message-service",
            "websocket-service",
            "notification-service",
        ]:
            assert svc in services
            assert services[svc]["status"] == "healthy"


@pytest.mark.asyncio
async def test_e2e_full_user_journey():
    """
    Executes a complete real-world multi-user journey across all microservices:
    1. Register User A & User B via Auth Service
    2. Retrieve Profile & Search via User Service
    3. Send & Accept Contact Request via Contacts System
    4. Initiate Direct Chat & Verify Deduplication via Chat Service
    5. Send & Receive Messages with Cursor Pagination via Message Service
    6. Mark Message as Read & Verify Receipt
    7. Query Notifications via Notification Service
    8. Connect to WebSocket tunnel via Gateway and exchange Ping/Pong
    """
    suffix = int(time.time() * 1000)
    user_a_email = f"alice_{suffix}@test.io"
    user_a_name = f"Alice Test {suffix}"
    user_a_uname = f"alice_{suffix}"
    password = "SecurePassword123!"

    user_b_email = f"bob_{suffix}@test.io"
    user_b_name = f"Bob Test {suffix}"
    user_b_uname = f"bob_{suffix}"

    user_a_id = None
    user_b_id = None
    conversation_id = None
    message_id = None

    async with httpx.AsyncClient(base_url=GATEWAY_HTTP_URL, timeout=15.0) as client:
        # 1. Register User A
        reg_a = await client.post(
            "/api/v1/auth/register",
            json={
                "name": user_a_name,
                "username": user_a_uname,
                "email": user_a_email,
                "password": password,
            },
        )
        assert reg_a.status_code == 201, f"User A registration failed: {reg_a.text}"
        data_a = reg_a.json()
        token_a = data_a["access_token"]
        user_a_id = data_a["user"]["id"]
        auth_header_a = {"Authorization": f"Bearer {token_a}"}

        # 2. Register User B
        reg_b = await client.post(
            "/api/v1/auth/register",
            json={
                "name": user_b_name,
                "username": user_b_uname,
                "email": user_b_email,
                "password": password,
            },
        )
        assert reg_b.status_code == 201, f"User B registration failed: {reg_b.text}"
        data_b = reg_b.json()
        token_b = data_b["access_token"]
        user_b_id = data_b["user"]["id"]
        auth_header_b = {"Authorization": f"Bearer {token_b}"}

        try:
            # 3. User A Profile Retrieval (User Service)
            me_resp = await client.get("/api/v1/users/me", headers=auth_header_a)
            assert me_resp.status_code == 200
            assert me_resp.json()["id"] == user_a_id

            # 4. User A searches for User B
            search_resp = await client.get(
                f"/api/v1/users/search?q={user_b_uname}", headers=auth_header_a
            )
            assert search_resp.status_code == 200
            search_results = search_resp.json().get("items", [])
            assert any(u["id"] == user_b_id for u in search_results)

            # 5. User A sends Contact Request to User B
            req_resp = await client.post(
                "/api/v1/contacts/requests",
                headers=auth_header_a,
                json={"recipient_id": user_b_id},
            )
            assert req_resp.status_code in (200, 201)
            contact_request_id = req_resp.json()["id"]

            # 6. User B lists requests and accepts
            b_requests = await client.get("/api/v1/contacts/requests", headers=auth_header_b)
            assert b_requests.status_code == 200
            received = b_requests.json().get("received", [])
            assert any(r["id"] == contact_request_id for r in received)

            accept_resp = await client.post(
                f"/api/v1/contacts/requests/{contact_request_id}/accept",
                headers=auth_header_b,
            )
            assert accept_resp.status_code == 200

            # 7. Check Contacts List for both users
            contacts_a = await client.get("/api/v1/contacts", headers=auth_header_a)
            assert contacts_a.status_code == 200
            assert any(c["contact_id"] == user_b_id for c in contacts_a.json().get("items", []))

            # 8. Create Direct Chat (Chat Service)
            chat_resp = await client.post(
                "/api/v1/conversations/direct",
                headers=auth_header_a,
                json={"recipient_id": user_b_id},
            )
            assert chat_resp.status_code == 200
            conv_data = chat_resp.json()
            conversation_id = conv_data["id"]

            # Deduplication: Creating direct chat again returns the exact same conversation
            chat_dedup = await client.post(
                "/api/v1/conversations/direct",
                headers=auth_header_a,
                json={"recipient_id": user_b_id},
            )
            assert chat_dedup.status_code == 200
            assert chat_dedup.json()["id"] == conversation_id

            # 9. Send Message from User A (Message Service)
            msg_text = f"Hello Bob! Testing Phase 25 E2E flow {suffix}"
            send_msg_resp = await client.post(
                f"/api/v1/conversations/{conversation_id}/messages",
                headers=auth_header_a,
                json={"content": msg_text, "type": "text"},
            )
            assert send_msg_resp.status_code == 201
            message_data = send_msg_resp.json()
            message_id = message_data["id"]
            assert message_data["content"] == msg_text
            assert message_data["status"] == "sent"

            # 10. User B Retrieves Message Timeline
            list_msg_resp = await client.get(
                f"/api/v1/conversations/{conversation_id}/messages",
                headers=auth_header_b,
            )
            assert list_msg_resp.status_code == 200
            msgs = list_msg_resp.json()["items"]
            assert any(m["id"] == message_id for m in msgs)

            # 11. User B Marks Message as Read (Read Receipt)
            read_resp = await client.post(
                f"/api/v1/messages/{message_id}/read",
                headers=auth_header_b,
            )
            assert read_resp.status_code == 200
            assert read_resp.json()["status"] == "read"

            # 12. User B Queries Notifications (Notification Service)
            notif_resp = await client.get("/api/v1/notifications", headers=auth_header_b)
            assert notif_resp.status_code == 200

            # 13. Test WebSocket Tunnel via Gateway
            ws_url = f"{GATEWAY_WS_URL}?token={token_a}"
            async with websockets.connect(ws_url) as ws:
                ack_raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
                ack = json.loads(ack_raw)
                assert ack["event"] == "connection.ack"
                assert ack["data"]["user_id"] == user_a_id

                # Send ping
                await ws.send(json.dumps({"event": "ping", "data": {}}))
                pong_raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
                pong = json.loads(pong_raw)
                assert pong["event"] == "pong"

        finally:
            # Cleanup Database Records
            mongo = AsyncIOMotorClient(MONGODB_URL, tlsCAFile=certifi.where())
            db = mongo.fluxchat_db
            if user_a_id:
                await db.users.delete_one({"_id": ObjectId(user_a_id)})
                await db.contacts.delete_many({"user_id": user_a_id})
                await db.contact_requests.delete_many({"sender_id": user_a_id})
            if user_b_id:
                await db.users.delete_one({"_id": ObjectId(user_b_id)})
                await db.contacts.delete_many({"user_id": user_b_id})
                await db.contact_requests.delete_many({"recipient_id": user_b_id})
            if conversation_id:
                await db.conversations.delete_one({"_id": ObjectId(conversation_id)})
                await db.messages.delete_many({"conversation_id": conversation_id})
            mongo.close()
