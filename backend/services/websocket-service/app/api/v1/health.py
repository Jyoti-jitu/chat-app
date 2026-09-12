"""
Health check endpoints for WebSocket Service.
"""
from fastapi import APIRouter, status
from app.core.config import settings
from app.core.connection_manager import connection_manager
from app.schemas.health import HealthResponse
from shared.database.mongodb import db_manager

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Service Health Check",
    description="Returns operational status of the WebSocket Service, database ping, and active connection count.",
)
async def health_check() -> HealthResponse:
    """Verifies service readiness and active connections."""
    is_db_connected = await db_manager.is_connected()
    db_status = "connected" if is_db_connected else "disconnected"
    db_error = None

    if is_db_connected:
        try:
            db = db_manager.get_database()
            await db.command("ping")
        except Exception as e:
            db_status = "error"
            db_error = str(e)

    return HealthResponse(
        status="ok" if db_status == "connected" else "degraded",
        database=db_status,
        service=settings.APP_NAME,
        version="1.0.0",
        environment=settings.APP_ENV,
        active_users=connection_manager.get_user_count(),
        active_connections=connection_manager.get_connection_count(),
        error=db_error,
    )
