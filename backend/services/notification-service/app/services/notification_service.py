"""
Business logic and Redis event dispatching for Notification Service.
"""
import logging
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from app.core.logging import logger
from app.repositories.notification_repository import (
    NotificationRepository,
    notification_repository,
)
from app.schemas.notification import (
    ActionSuccessResponse,
    ActorProfile,
    CreateNotificationPayload,
    NotificationListResponse,
    NotificationResponse,
)
from shared.redis.client import redis_manager


class NotificationService:
    """Business logic for notifications subsystem."""

    def __init__(self):
        self.repo = notification_repository

    async def _to_response(self, doc: Dict[str, Any]) -> NotificationResponse:
        """Hydrates actor and constructs sanitized NotificationResponse."""
        actor_data = doc.get("actor")
        if not actor_data:
            actor_data = await self.repo.get_actor_profile(doc.get("actor_id"))

        actor = ActorProfile(
            name=actor_data.get("name", "System") if actor_data else "System",
            username=actor_data.get("username") if actor_data else None,
            avatar=actor_data.get("avatar") if actor_data else None,
        )

        return NotificationResponse(
            id=str(doc.get("_id", doc.get("id"))),
            user_id=str(doc.get("user_id")),
            type=doc.get("type", "message"),
            category=doc.get("category", "messages"),
            actor=actor,
            title=doc.get("title"),
            description=doc.get("description", ""),
            reference_id=doc.get("reference_id"),
            link=doc.get("link"),
            is_read=doc.get("is_read", False),
            created_at=doc.get("created_at"),
        )

    async def get_user_notifications(
        self,
        user_id: str,
        category: Optional[str] = None,
        limit: int = 50,
        skip: int = 0,
    ) -> NotificationListResponse:
        """Fetches notifications with category filtering and unread count."""
        items = await self.repo.get_user_notifications(
            user_id=user_id,
            category=category,
            limit=limit,
            skip=skip,
        )
        total = await self.repo.count_user_notifications(user_id=user_id, category=category)
        unread = await self.repo.count_unread(user_id=user_id)

        responses = [await self._to_response(doc) for doc in items]
        return NotificationListResponse(
            items=responses,
            total=total,
            unread_count=unread,
        )

    async def create_notification(
        self, payload: CreateNotificationPayload
    ) -> NotificationResponse:
        """Persists notification and broadcasts live socket event via Redis."""
        doc_data = {
            "user_id": str(payload.user_id),
            "actor_id": str(payload.actor_id) if payload.actor_id else None,
            "type": payload.type,
            "category": payload.category,
            "title": payload.title,
            "description": payload.description,
            "reference_id": payload.reference_id,
            "link": payload.link,
        }

        created = await self.repo.create_notification(doc_data)
        response = await self._to_response(created)

        # Dispatch real-time WebSocket event to target user via Redis
        try:
            await redis_manager.publish(
                "fluxchat:events",
                {
                    "event": "notification.new",
                    "data": response.model_dump(mode="json"),
                    "recipients": [str(payload.user_id)],
                },
            )
        except Exception as e:
            logger.warning(f"Failed to publish notification.new to Redis: {e}")

        return response

    async def mark_as_read(
        self, user_id: str, notification_id: str
    ) -> ActionSuccessResponse:
        """Marks single notification as read."""
        success = await self.repo.mark_as_read(user_id, notification_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found or already read.",
            )
        return ActionSuccessResponse(
            success=True,
            message="Notification marked as read.",
        )

    async def mark_all_as_read(self, user_id: str) -> ActionSuccessResponse:
        """Marks all unread notifications as read."""
        count = await self.repo.mark_all_as_read(user_id)
        return ActionSuccessResponse(
            success=True,
            message="All notifications marked as read.",
            count=count,
        )

    async def delete_notification(
        self, user_id: str, notification_id: str
    ) -> ActionSuccessResponse:
        """Dismisses an individual notification."""
        success = await self.repo.delete_notification(user_id, notification_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found.",
            )
        return ActionSuccessResponse(
            success=True,
            message="Notification dismissed successfully.",
        )

    async def clear_all(self, user_id: str) -> ActionSuccessResponse:
        """Clears all notifications for the user."""
        count = await self.repo.clear_all_notifications(user_id)
        return ActionSuccessResponse(
            success=True,
            message="All notifications cleared.",
            count=count,
        )


notification_service = NotificationService()
