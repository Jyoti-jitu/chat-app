"""
Health check route handler for User Service.
"""
from fastapi import APIRouter, Response, status
from app.core.config import settings
from app.schemas.health import HealthResponse
from shared.database.mongodb import db_manager
from shared.health.schemas import LivenessResponse, ReadinessResponse
from shared.health.probes import get_uptime_seconds

router = APIRouter(tags=["Health"])


@router.get(
    "/health/live",
    response_model=LivenessResponse,
    status_code=status.HTTP_200_OK,
    summary="Service Liveness Probe",
    description="Validates that the process is running and the event loop is responsive.",
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
        200: {"description": "Service is ready to accept traffic"},
        503: {"description": "MongoDB Atlas connection unavailable"},
    },
    summary="Service Readiness Probe",
    description="Validates MongoDB Atlas connectivity before accepting user requests.",
)
async def readiness_probe(response: Response) -> ReadinessResponse:
    is_connected = await db_manager.is_connected()
    if not is_connected:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return ReadinessResponse(
            status="unready",
            service=settings.APP_NAME,
            database="disconnected",
            error="MongoDB Atlas connection unavailable",
        )
    return ReadinessResponse(
        status="ok",
        service=settings.APP_NAME,
        database="connected",
    )


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

