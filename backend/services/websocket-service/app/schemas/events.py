"""
WebSocket Event Models and Standardized Protocol Payloads.
Follows the standardized envelope:
{
    "event": "message.new",
    "timestamp": 1740000000,
    "data": { ... }
}
"""
import time
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class WebSocketEvent(BaseModel):
    """Standard event message envelope exchanged over WebSocket."""

    event: str = Field(..., description="Event identifier (e.g. message.new, typing.start)")
    data: Dict[str, Any] = Field(default_factory=dict, description="Event payload body")
    timestamp: int = Field(default_factory=lambda: int(time.time()), description="Epoch seconds timestamp")


class BroadcastEventPayload(BaseModel):
    """Payload for internal microservice REST bridge to broadcast events."""

    event: str = Field(..., description="Event identifier")
    data: Dict[str, Any] = Field(default_factory=dict, description="Event payload dictionary")
    recipient_ids: Optional[List[str]] = Field(
        default=None,
        description="Target user IDs to receive this event. If None or empty, broadcasts to all.",
    )
    exclude_user_id: Optional[str] = Field(
        default=None,
        description="User ID to omit from receiving this broadcast (usually the actor).",
    )


class OnlinePresenceResponse(BaseModel):
    """Summary of currently connected users and sockets."""

    online_users: List[str]
    total_online: int
    total_connections: int


class UserPresenceResponse(BaseModel):
    """Presence status for an individual user."""

    user_id: str
    is_online: bool
