"""
Pydantic Schemas for FluxChat Notification Service.
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ActorProfile(BaseModel):
    """Actor identity snapshot embedded in notifications."""

    name: str = "System"
    username: Optional[str] = None
    avatar: Optional[str] = None


class NotificationResponse(BaseModel):
    """Client sanitized notification item matching frontend contracts."""

    id: str
    user_id: str
    type: str = Field(default="message", description="message | request | reaction | mention | file | system")
    category: str = Field(default="messages", description="messages | requests | system")
    actor: ActorProfile
    title: Optional[str] = None
    description: str
    reference_id: Optional[str] = None
    link: Optional[str] = None
    is_read: bool = False
    created_at: Optional[str] = None


class NotificationListResponse(BaseModel):
    """Paginated or filtered list of notifications with unread badge counter."""

    items: List[NotificationResponse]
    total: int
    unread_count: int


class CreateNotificationPayload(BaseModel):
    """Payload to enqueue or persist a notification for a target user."""

    user_id: str
    actor_id: Optional[str] = None
    type: str = "message"
    category: str = "messages"
    title: Optional[str] = None
    description: str
    reference_id: Optional[str] = None
    link: Optional[str] = None


class ActionSuccessResponse(BaseModel):
    """Generic action acknowledgment response."""

    success: bool = True
    message: str
    count: Optional[int] = None
