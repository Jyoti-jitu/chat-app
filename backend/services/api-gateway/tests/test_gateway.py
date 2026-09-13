"""
Unit and Integration Tests for FluxChat API Gateway.
"""
import pytest
from starlette.testclient import TestClient
from app.main import app
from app.core.rate_limiter import SlidingWindowRateLimiter


def test_root_health_aggregator():
    """Tests that the cluster health aggregator reports all 6 downstream microservices."""
    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        assert "services" in data
        assert "auth-service" in data["services"]
        assert "user-service" in data["services"]
        assert "chat-service" in data["services"]
        assert "message-service" in data["services"]
        assert "websocket-service" in data["services"]
        assert "notification-service" in data["services"]


def test_request_id_generation():
    """Tests that the gateway automatically tags requests with an X-Request-ID header."""
    with TestClient(app) as client:
        resp = client.get("/health")
        assert "x-request-id" in resp.headers
        assert resp.headers["x-request-id"].startswith("req_")


def test_request_id_preservation():
    """Tests that a client-provided X-Request-ID is preserved and propagated."""
    custom_id = "req_custom_trace_9999"
    with TestClient(app) as client:
        resp = client.get("/health", headers={"x-request-id": custom_id})
        assert resp.headers.get("x-request-id") == custom_id


def test_sliding_window_rate_limiter_unit():
    """Tests unit behavior of the SlidingWindowRateLimiter class."""
    limiter = SlidingWindowRateLimiter(window_seconds=10)
    key = "test_client_ip"

    # Allow 3 requests
    for i in range(3):
        allowed, limit, remaining, reset = limiter.check(key, limit=3)
        assert allowed is True
        assert remaining == 2 - i

    # 4th request must be rejected
    allowed, limit, remaining, reset = limiter.check(key, limit=3)
    assert allowed is False
    assert remaining == 0
    assert reset > 0


def test_rate_limiting_middleware():
    """Tests that requests exceeding the quota are returned 429 Too Many Requests."""
    with TestClient(app) as client:
        # Use an isolated path and unique IP via X-Forwarded-For
        client_ip = "192.168.10.99"
        headers = {"x-forwarded-for": client_ip}

        # Auth limit is 25 in settings, let's test hitting a non-existent auth path repeatedly
        # or we test hitting a route repeatedly until 429
        got_429 = False
        for _ in range(30):
            resp = client.get("/api/v1/auth/non-existent-probe", headers=headers)
            if resp.status_code == 429:
                got_429 = True
                assert "x-ratelimit-remaining" in resp.headers
                assert resp.headers["x-ratelimit-remaining"] == "0"
                body = resp.json()
                assert body["error"]["code"] == "TOO_MANY_REQUESTS"
                break

        assert got_429 is True


def test_bad_gateway_on_unreachable_service():
    """Tests that an unreachable downstream service returns 502 Bad Gateway with standard error schema."""
    from starlette.requests import Request
    import asyncio
    from app.services.http_proxy import proxy_request

    # Construct dummy ASGI request pointing to closed port 59999
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/test",
        "headers": [],
        "query_string": b"",
    }
    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    req = Request(scope, receive)

    resp = asyncio.run(proxy_request(req, "http://127.0.0.1:59999"))
    assert resp.status_code == 502
    assert "x-request-id" in resp.headers


def test_proxy_auth_service():
    """Tests forwarding to live Auth Service (port 8001)."""
    with TestClient(app) as client:
        # POST with empty body should be received by Auth Service and return 422 Unprocessable Entity
        resp = client.post("/api/v1/auth/register", json={})
        assert resp.status_code == 422
        assert "x-request-id" in resp.headers


def test_proxy_user_service():
    """Tests forwarding to live User Service (port 8002)."""
    with TestClient(app) as client:
        # Requesting /me without Authorization header should return 401 Unauthorized
        resp = client.get("/api/v1/users/me")
        assert resp.status_code == 401
        assert "x-request-id" in resp.headers


def test_proxy_chat_service():
    """Tests forwarding to live Chat Service (port 8003)."""
    with TestClient(app) as client:
        resp = client.get("/api/v1/conversations")
        assert resp.status_code == 401
        assert "x-request-id" in resp.headers


def test_proxy_message_service():
    """Tests forwarding to live Message Service (port 8004)."""
    with TestClient(app) as client:
        resp = client.get("/api/v1/conversations/conv_test_123/messages")
        assert resp.status_code == 401
        assert "x-request-id" in resp.headers



def test_proxy_notification_service():
    """Tests forwarding to live Notification Service (port 8006)."""
    with TestClient(app) as client:
        resp = client.get("/api/v1/notifications")
        assert resp.status_code == 401
        assert "x-request-id" in resp.headers


def test_gateway_liveness_and_readiness_probes():
    """Tests service liveness and readiness health probes on API Gateway."""
    with TestClient(app) as client:
        # Root probes
        live_resp = client.get("/health/live")
        assert live_resp.status_code == 200
        assert live_resp.json()["status"] == "ok"
        assert "uptime_seconds" in live_resp.json()

        ready_resp = client.get("/health/ready")
        assert ready_resp.status_code == 200
        assert ready_resp.json()["status"] == "ok"

        # Versioned probes (/api/v1/health/...)
        v1_live = client.get("/api/v1/health/live")
        assert v1_live.status_code == 200
        assert v1_live.json()["status"] == "ok"

        v1_ready = client.get("/api/v1/health/ready")
        assert v1_ready.status_code == 200
        assert v1_ready.json()["status"] == "ok"


def test_gateway_direct_auth_proxy_routing():
    """Tests that /auth/* routes are routed directly through to Auth Service."""
    with TestClient(app) as client:
        resp = client.post("/auth/send-otp", json={"phone": "9876543210"})
        # Should NOT return 404 Not Found
        assert resp.status_code != 404




