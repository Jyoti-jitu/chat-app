"""
API v1 Router registry for Chat Service.
"""
from fastapi import APIRouter
from app.api.v1.conversations import router as conversations_router
from app.api.v1.health import router as health_router

api_v1_router = APIRouter(prefix="/api/v1")

# Mount endpoints
api_v1_router.include_router(health_router)
api_v1_router.include_router(conversations_router)
