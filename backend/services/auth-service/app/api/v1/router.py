from fastapi import APIRouter
from app.schemas.health import HealthResponse
from app.core.config import settings
from shared.database.mongodb import db_manager
from app.api.v1.auth import router as auth_router

api_router = APIRouter()

# Mount authentication endpoints under /auth
api_router.include_router(auth_router, prefix="/auth")


@api_router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health Check (v1)",
    description="Returns the operational status of the service and MongoDB under /api/v1.",
)
async def v1_health_check() -> HealthResponse:
    db_connected = await db_manager.is_connected()
    return HealthResponse(
        status="ok" if db_connected else "degraded",
        database="connected" if db_connected else "disconnected",
        service=settings.APP_NAME,
        version="1.0.0",
        environment=settings.APP_ENV,
    )

