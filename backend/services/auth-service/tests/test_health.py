import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from shared.database.mongodb import db_manager
from app.core.config import settings


@pytest_asyncio.fixture(autouse=True)
async def initialize_db():
    """Ensure database connection is active during test execution."""
    await db_manager.connect(settings.MONGODB_URL, settings.MONGODB_DATABASE)
    yield
    await db_manager.disconnect()




@pytest.mark.asyncio
async def test_root_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert data["service"] == "FluxChat Auth Service"
    assert data["docs_url"] == "/docs"
    assert data["health_url"] == "/health"
    assert "database" in data


@pytest.mark.asyncio
async def test_root_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"
    assert data["service"] == "FluxChat Auth Service"
    assert data["version"] == "1.0.0"


@pytest.mark.asyncio
async def test_v1_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"
    assert data["service"] == "FluxChat Auth Service"


@pytest.mark.asyncio
async def test_mongodb_manager_lifecycle():
    assert await db_manager.is_connected() is True
    db = db_manager.get_database()
    assert db.name == settings.MONGODB_DATABASE
    ping = await db.command("ping")
    assert ping.get("ok") == 1.0

