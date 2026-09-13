"""
Pydantic schemas for 24-hour Status / Stories feature.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class CreateStatusPayload(BaseModel):
    """Payload to post a new status slide (photo or text)."""
    type: str = Field("text", description="'image' | 'text'")
    content: str = Field(..., min_length=1, max_length=5000, description="Cloudinary media URL or text content")
    caption: Optional[str] = Field(None, max_length=500, description="Optional photo caption")
    background_color: Optional[str] = Field(None, description="Tailwind gradient or color code")
    font_style: Optional[str] = Field("modern", description="'modern' | 'serif' | 'mono' | 'bold'")


class StatusSlideResponse(BaseModel):
    """Individual slide in a user's 24h status story."""
    id: str
    type: str
    content: str
    caption: Optional[str] = None
    background_color: Optional[str] = None
    font_style: Optional[str] = None
    created_at: datetime
    expires_at: datetime


class UserStatusResponse(BaseModel):
    """Aggregated status story for a single user."""
    id: str
    user_id: str
    user_name: str
    user_avatar: Optional[str] = None
    user_initials: str
    is_me: bool = False
    slides: List[StatusSlideResponse]
    viewed: bool = False
    last_updated: datetime


class StatusFeedResponse(BaseModel):
    """List of active statuses visible to the user."""
    items: List[UserStatusResponse]
    total: int


class ActionSuccessResponse(BaseModel):
    """Generic status action response."""
    status: str = "ok"
    message: str
