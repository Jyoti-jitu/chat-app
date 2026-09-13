"""
Pydantic schemas for Conversation operations (direct and group chat).
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class CreateDirectConversation(BaseModel):
    """Payload for initiating or opening a 1:1 direct conversation."""
    recipient_id: str = Field(..., description="Target user ID to chat with")


class CreateGroupConversation(BaseModel):
    """Payload for creating a new group conversation."""
    name: str = Field(..., min_length=1, max_length=100, description="Group conversation title")
    member_ids: List[str] = Field(..., min_length=1, description="List of participant user IDs")
    avatar: Optional[str] = Field(None, description="Optional custom group avatar image URL")


class UpdateGroupConversation(BaseModel):
    """Payload for updating group metadata."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    avatar: Optional[str] = Field(None)


class AddMembersPayload(BaseModel):
    """Payload for adding participants to an existing group."""
    member_ids: List[str] = Field(..., min_length=1, description="List of user IDs to add")


class ConversationMemberInfo(BaseModel):
    """Sanitized public profile of a conversation participant."""
    id: str
    name: str
    username: str
    avatar: Optional[str] = None
    is_online: bool = False
    last_seen: Optional[datetime] = None


class LastMessageInfo(BaseModel):
    """Preview of the most recent message in the thread."""
    id: Optional[str] = None
    sender_id: Optional[str] = None
    sender_name: Optional[str] = None
    content: Optional[str] = None
    timestamp: Optional[datetime] = None


class ConversationResponse(BaseModel):
    """Detailed conversation representation for API clients."""
    id: str
    type: str = Field(..., description="'direct' or 'group'")
    name: Optional[str] = Field(None, description="Group title or counterpart name for direct chats")
    avatar: Optional[str] = Field(None, description="Group avatar or counterpart avatar for direct chats")
    member_ids: List[str] = Field(default_factory=list)
    members: List[ConversationMemberInfo] = Field(default_factory=list)
    admins: List[str] = Field(default_factory=list)
    created_by: Optional[str] = None
    last_message: Optional[LastMessageInfo] = None
    unread_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ConversationListResponse(BaseModel):
    """List of conversations belonging to the authenticated user."""
    items: List[ConversationResponse]
    total: int


class ActionSuccessResponse(BaseModel):
    """Generic status response for conversation mutations."""
    status: str = "ok"
    message: str
