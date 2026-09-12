"""
Pydantic schemas for Message operations (sending, editing, soft deleting, and read receipts).
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class MessageAttachment(BaseModel):
    """File or media attachment attached to a message."""
    name: str = Field(..., description="File name")
    size: str = Field(..., description="Formatted file size (e.g. '2.4 MB')")
    url: str = Field(..., description="Downloadable or viewable resource URL")
    type: str = Field("file", description="Resource type: 'file' | 'image' | 'audio'")


class SendMessagePayload(BaseModel):
    """Payload for creating/sending a message to a conversation."""
    content: str = Field(..., min_length=1, max_length=5000, description="Message text content")
    type: str = Field("text", description="Message type: 'text' | 'image' | 'file' | 'audio'")
    attachment: Optional[MessageAttachment] = Field(None, description="Optional attachment details")
    reply_to: Optional[str] = Field(None, description="Target parent message ID for replies")


class EditMessagePayload(BaseModel):
    """Payload for editing existing message content."""
    content: str = Field(..., min_length=1, max_length=5000, description="Updated message content")


class MessageResponse(BaseModel):
    """Public message data contract."""
    id: str
    conversation_id: str
    sender_id: str
    content: str
    type: str = "text"
    attachment: Optional[MessageAttachment] = None
    reply_to: Optional[str] = None
    status: str = "sent"
    edited: bool = False
    deleted: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class MessageListResponse(BaseModel):
    """Paginated list of messages in a conversation thread with cursor support."""
    items: List[MessageResponse]
    total: int
    next_cursor: Optional[str] = None
    has_more: bool = False


class ActionSuccessResponse(BaseModel):
    """Action acknowledgment response."""
    status: str = "ok"
    message: str
