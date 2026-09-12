"""
Automated Test Suite for Phases 20, 21 & 22 Shared Infrastructure.
Tests ServiceClient, Standardized Error Handlers, and Structured JSON Logging.
"""
import json
import logging
import pytest
from fastapi import FastAPI
from pydantic import BaseModel
from starlette.testclient import TestClient

from shared.clients.service_client import ServiceClient, get_auth_client
from shared.errors.exceptions import (
    AuthenticationError,
    BadGatewayError,
    NotFoundError,
    RateLimitError,
    ValidationError,
)
from shared.errors.handlers import register_exception_handlers
from shared.logging.structured_logger import (
    JsonFormatter,
    RequestLoggingMiddleware,
    sanitize_dict,
)


def test_credential_sanitization():
    """Tests that sensitive keys are deeply redacted."""
    raw_payload = {
        "username": "alice",
        "password": "SuperSecretPassword123!",
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "nested": {
            "refreshToken": "refresh_secret_token",
            "authorization": "Bearer token_abc",
            "otp": "123456",
            "api_key": "sec_key_xyz",
            "safe_counter": 42,
        },
    }
    sanitized = sanitize_dict(raw_payload)
    assert sanitized["username"] == "alice"
    assert sanitized["password"] == "[REDACTED]"
    assert sanitized["token"] == "[REDACTED]"
    assert sanitized["nested"]["refreshToken"] == "[REDACTED]"
    assert sanitized["nested"]["authorization"] == "[REDACTED]"
    assert sanitized["nested"]["otp"] == "[REDACTED]"
    assert sanitized["nested"]["api_key"] == "[REDACTED]"
    assert sanitized["nested"]["safe_counter"] == 42


def test_structured_json_formatter():
    """Tests that JsonFormatter produces valid single-line JSON logs."""
    formatter = JsonFormatter(service_name="test-service")
    record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname="",
        lineno=0,
        msg="User authenticated successfully",
        args=(),
        exc_info=None,
    )
    record.request_id = "req_test_123"
    record.user_id = "u_test_456"

    formatted = formatter.format(record)
    log_obj = json.loads(formatted)
    assert log_obj["service"] == "test-service"
    assert log_obj["level"] == "INFO"
    assert log_obj["message"] == "User authenticated successfully"
    assert log_obj["request_id"] == "req_test_123"
    assert log_obj["user_id"] == "u_test_456"
    assert "timestamp" in log_obj


def test_standardized_error_handlers():
    """Tests that FastAPI exception handlers output canonical Phase 21 error JSON."""
    test_app = FastAPI()
    register_exception_handlers(test_app)

    class TestBody(BaseModel):
        email: str

    @test_app.get("/trigger-not-found")
    def trigger_404():
        raise NotFoundError("The requested conversation was not found.")

    @test_app.get("/trigger-auth-error")
    def trigger_401():
        raise AuthenticationError("Bearer token expired.")

    @test_app.post("/trigger-validation")
    def trigger_422(body: TestBody):
        return {"ok": True}

    with TestClient(test_app) as client:
        # 1. Test NotFoundError (404)
        resp_404 = client.get("/trigger-not-found")
        assert resp_404.status_code == 404
        assert "x-request-id" in resp_404.headers
        data_404 = resp_404.json()
        assert "error" in data_404
        assert data_404["error"]["code"] == "NOT_FOUND"
        assert data_404["error"]["message"] == "The requested conversation was not found."
        assert "timestamp" in data_404["error"]
        assert "request_id" in data_404["error"]

        # 2. Test AuthenticationError (401)
        resp_401 = client.get("/trigger-auth-error")
        assert resp_401.status_code == 401
        data_401 = resp_401.json()
        assert data_401["error"]["code"] == "AUTHENTICATION_FAILED"
        assert data_401["error"]["message"] == "Bearer token expired."

        # 3. Test RequestValidationError (422)
        resp_422 = client.post("/trigger-validation", json={})
        assert resp_422.status_code == 422
        data_422 = resp_422.json()
        assert data_422["error"]["code"] == "VALIDATION_ERROR"
        assert "details" in data_422["error"]


@pytest.mark.asyncio
async def test_service_client_live_probe():
    """Tests ServiceClient against live Auth Service on port 8001."""
    client = get_auth_client()
    try:
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
    finally:
        await client.close()


@pytest.mark.asyncio
async def test_service_client_error_translation():
    """Tests that ServiceClient translates 404/401 HTTP errors into domain exceptions."""
    client = ServiceClient("http://127.0.0.1:8001", target_service="auth-service")
    try:
        with pytest.raises(NotFoundError):
            await client.get("/api/v1/auth/non-existent-route-for-test-xyz")
    finally:
        await client.close()


@pytest.mark.asyncio
async def test_service_client_bad_gateway():
    """Tests that ServiceClient raises BadGatewayError when downstream port is closed."""
    client = ServiceClient("http://127.0.0.1:59998", target_service="offline-service", max_retries=1, timeout=1.0)
    try:
        with pytest.raises(BadGatewayError):
            await client.get("/health")
    finally:
        await client.close()
