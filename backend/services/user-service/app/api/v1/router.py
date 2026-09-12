"""
Version 1 central API router for User Service.
"""
from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.users import router as users_router
from app.api.v1.contacts import router as contacts_router

v1_router = APIRouter(prefix="/api/v1")

v1_router.include_router(health_router)
v1_router.include_router(users_router)
v1_router.include_router(contacts_router)
