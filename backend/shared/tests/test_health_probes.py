"""
Unit tests for shared service health probes (Liveness & Readiness).
"""
import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient
from shared.health import create_health_probe_router, get_uptime_seconds


@pytest.mark.asyncio
async def test_uptime_seconds_increases():
    uptime1 = get_uptime_seconds()
    assert isinstance(uptime1, float)
    assert uptime1 >= 0.0


def test_liveness_probe_returns_200():
    app = FastAPI()
    router = create_health_probe_router(service_name="Test Service")
    app.include_router(router, prefix="/health")

    client = TestClient(app)
    response = client.get("/health/live")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "Test Service"
    assert "uptime_seconds" in data
    assert "timestamp" in data


def test_readiness_probe_success():
    async def mock_db_ok():
        return True

    async def mock_redis_ok():
        return True

    app = FastAPI()
    router = create_health_probe_router(
        service_name="Test Ready Service",
        db_check=mock_db_ok,
        redis_check=mock_redis_ok,
    )
    app.include_router(router, prefix="/health")

    client = TestClient(app)
    response = client.get("/health/ready")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"
    assert data["redis"] == "connected"
    assert data["error"] is None


def test_readiness_probe_failure_db_disconnected():
    async def mock_db_down():
        return False

    async def mock_redis_ok():
        return True

    app = FastAPI()
    router = create_health_probe_router(
        service_name="Test Unready Service",
        db_check=mock_db_down,
        redis_check=mock_redis_ok,
    )
    app.include_router(router, prefix="/health")

    client = TestClient(app)
    response = client.get("/health/ready")
    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    data = response.json()
    assert data["status"] == "unready"
    assert data["database"] == "disconnected"
    assert data["redis"] == "connected"
    assert "MongoDB connection not ready" in data["error"]


def test_readiness_probe_failure_exception():
    async def mock_db_exception():
        raise ConnectionError("DNS resolution failed for cluster.mongodb.net")

    app = FastAPI()
    router = create_health_probe_router(
        service_name="Test Exception Service",
        db_check=mock_db_exception,
    )
    app.include_router(router, prefix="/health")

    client = TestClient(app)
    response = client.get("/health/ready")
    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    data = response.json()
    assert data["status"] == "unready"
    assert data["database"] == "error"
    assert "DNS resolution failed" in data["error"]
