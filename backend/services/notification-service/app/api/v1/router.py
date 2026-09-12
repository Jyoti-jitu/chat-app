"""
Aggregated API v1 Router for Notification Service.
"""
from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.notifications import router as notifications_router

api_v1_router = APIRouter(prefix="/api/v1")

# Mount sub-routers
api_v1_router.include_router(health_router)
api_v1_router.include_router(notifications_router)
