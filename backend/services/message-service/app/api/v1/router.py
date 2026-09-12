"""
API v1 Router registry for Message Service.
"""
from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.messages import router as messages_router

api_v1_router = APIRouter(prefix="/api/v1")

# Mount endpoints
api_v1_router.include_router(health_router)
api_v1_router.include_router(messages_router)
