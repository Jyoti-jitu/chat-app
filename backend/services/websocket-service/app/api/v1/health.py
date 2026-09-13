"""
Health check endpoints for WebSocket Service.
"""
from fastapi import APIRouter, Response, status
from app.core.config import settings
from app.core.connection_manager import connection_manager
from app.schemas.health import HealthResponse
from shared.database.mongodb import db_manager
from shared.redis.client import redis_manager
from shared.health.schemas import LivenessResponse, ReadinessResponse
from shared.health.probes import get_uptime_seconds

router = APIRouter(tags=["Health"])


@router.get(
    "/health/live",
    response_model=LivenessResponse,
    status_code=status.HTTP_200_OK,
    summary="Service Liveness Probe",
    description="Validates that the WebSocket process is running and the event loop is responsive.",
)
async def liveness_probe() -> LivenessResponse:
    return LivenessResponse(
        status="ok",
        service=settings.APP_NAME,
        uptime_seconds=get_uptime_seconds(),
    )


@router.get(
    "/health/ready",
    response_model=ReadinessResponse,
    responses={
        200: {"description": "Service is ready to accept WebSocket and HTTP connections"},
        503: {"description": "MongoDB or Redis backing service unavailable"},
    },
    summary="Service Readiness Probe",
    description="Validates MongoDB and Redis Pub/Sub connectivity before routing traffic.",
)
async def readiness_probe(response: Response) -> ReadinessResponse:
    is_db_connected = await db_manager.is_connected()
    is_redis_connected = await redis_manager.is_connected()

    all_ready = is_db_connected and is_redis_connected
    if not all_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        errors = []
        if not is_db_connected:
            errors.append("MongoDB Atlas unavailable")
        if not is_redis_connected:
            errors.append("Redis unavailable")

        return ReadinessResponse(
            status="unready",
            service=settings.APP_NAME,
            database="connected" if is_db_connected else "disconnected",
            redis="connected" if is_redis_connected else "disconnected",
            error="; ".join(errors),
        )

    return ReadinessResponse(
        status="ok",
        service=settings.APP_NAME,
        database="connected",
        redis="connected",
    )


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

