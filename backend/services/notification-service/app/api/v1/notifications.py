"""
Notification Endpoints for FluxChat.
Provides user notification listing, category filters, read receipts, and dismissal.
"""
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query, status
from app.schemas.notification import (
    ActionSuccessResponse,
    CreateNotificationPayload,
    NotificationListResponse,
    NotificationResponse,
)
from app.services.notification_service import (
    NotificationService,
    notification_service,
)
from shared.security.dependencies import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get(
    "",
    response_model=NotificationListResponse,
    status_code=status.HTTP_200_OK,
    summary="List User Notifications",
    description="Returns notifications for the authenticated user, optionally filtered by category.",
)
async def list_notifications(
    category: Optional[str] = Query(None, description="all | messages | requests | system"),
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> NotificationListResponse:
    """Retrieves notifications for the caller with unread badges."""
    return await notification_service.get_user_notifications(
        user_id=str(current_user["id"]),
        category=category,
        limit=limit,
        skip=skip,
    )


@router.post(
    "",
    response_model=NotificationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create / Enqueue Notification",
    description="Internal endpoint to persist and push a real-time notification to a user.",
)
async def create_notification(
    payload: CreateNotificationPayload,
) -> NotificationResponse:
    """Enqueues a notification and publishes to Redis Pub/Sub."""
    return await notification_service.create_notification(payload)


@router.post(
    "/{notification_id}/read",
    response_model=ActionSuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark Notification as Read",
)
async def mark_as_read(
    notification_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ActionSuccessResponse:
    """Marks a single notification as read."""
    return await notification_service.mark_as_read(
        user_id=str(current_user["id"]),
        notification_id=notification_id,
    )


@router.post(
    "/read-all",
    response_model=ActionSuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark All Notifications as Read",
)
async def mark_all_as_read(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ActionSuccessResponse:
    """Marks all notifications for the authenticated user as read."""
    return await notification_service.mark_all_as_read(
        user_id=str(current_user["id"]),
    )


@router.delete(
    "/{notification_id}",
    response_model=ActionSuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Dismiss Notification",
)
async def dismiss_notification(
    notification_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ActionSuccessResponse:
    """Deletes an individual notification."""
    return await notification_service.delete_notification(
        user_id=str(current_user["id"]),
        notification_id=notification_id,
    )


@router.delete(
    "",
    response_model=ActionSuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Clear All Notifications",
)
async def clear_all_notifications(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ActionSuccessResponse:
    """Clears all notifications for the authenticated user."""
    return await notification_service.clear_all(
        user_id=str(current_user["id"]),
    )
