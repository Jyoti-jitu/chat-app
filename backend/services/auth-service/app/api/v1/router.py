from fastapi import APIRouter
from app.schemas.health import HealthResponse
from app.core.config import settings

api_router = APIRouter()


@api_router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health Check (v1)",
    description="Returns the operational status of the service under /api/v1.",
)
async def v1_health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service=settings.APP_NAME,
        version="1.0.0",
        environment=settings.APP_ENV,
    )
