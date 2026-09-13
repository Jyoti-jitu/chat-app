"""
Status API Routes for 24-hour Status / Stories.
Mounted under `/api/v1/status`.
"""
from typing import Any, Dict
from fastapi import APIRouter, Depends, status

from app.schemas.status import (
    ActionSuccessResponse,
    CreateStatusPayload,
    StatusFeedResponse,
    StatusSlideResponse,
)
from app.services.status_service import status_service
from shared.security.dependencies import get_current_user

router = APIRouter(prefix="/status", tags=["status"])


@router.post("", response_model=StatusSlideResponse, status_code=status.HTTP_201_CREATED)
async def create_status(
    payload: CreateStatusPayload,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Posts a new status slide (photo or text) that expires automatically in 24 hours."""
    return await status_service.create_status(current_user["id"], payload)


@router.get("", response_model=StatusFeedResponse)
async def get_status_feed(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Fetches all active 24-hour status stories from the user and their accepted contacts."""
    return await status_service.get_status_feed(current_user["id"])


@router.delete("/{slide_id}", response_model=ActionSuccessResponse)
async def delete_status_slide(
    slide_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Deletes an individual status slide belonging to the caller."""
    return await status_service.delete_slide(current_user["id"], slide_id)


@router.delete("", response_model=ActionSuccessResponse)
async def delete_my_status(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Deletes all status slides belonging to the caller."""
    return await status_service.delete_my_statuses(current_user["id"])
