"""
Health check route handler for User Service.
"""
from fastapi import APIRouter, status
from app.core.config import settings
from app.schemas.health import HealthResponse
from shared.database.mongodb import db_manager

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="User Service Health Check",
    description="Returns service status and validates MongoDB connectivity.",
)
async def health_check() -> HealthResponse:
    """Verifies operational status of the service and MongoDB Atlas."""
    is_db_connected = await db_manager.is_connected()
    db_status = "connected" if is_db_connected else "disconnected"

    return HealthResponse(
        status="ok" if is_db_connected else "degraded",
        service=settings.APP_NAME,
        version="1.0.0",
        environment=settings.APP_ENV,
        database=db_status,
    )
