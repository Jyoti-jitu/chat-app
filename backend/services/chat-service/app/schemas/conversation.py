"""
Pydantic schemas for Conversation operations (direct and group chat).
Includes group admin controls, join approval settings, and join requests.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CreateDirectConversation(BaseModel):
    """Payload for initiating or opening a 1:1 direct conversation."""
    recipient_id: str = Field(..., description="Target user ID to chat with")


class CreateGroupConversation(BaseModel):
    """Payload for creating a new group conversation."""
    name: str = Field(..., min_length=1, max_length=100, description="Group conversation title")
    member_ids: List[str] = Field(default_factory=list, description="Optional initial participant user IDs")
    avatar: Optional[str] = Field(None, description="Optional custom group avatar image URL")
    description: Optional[str] = Field(None, max_length=500, description="Optional group topic / description")
    join_mode: Optional[str] = Field("open", description="'open' (anyone can join) or 'approval' (admin approval required)")


class UpdateGroupConversation(BaseModel):
    """Payload for updating group metadata."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    avatar: Optional[str] = Field(None)
    description: Optional[str] = Field(None, max_length=500)
    join_mode: Optional[str] = Field(None, description="'open' | 'approval'")


class UpdateGroupSettingsPayload(BaseModel):
    """Payload for admin-only group configuration."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    avatar: Optional[str] = Field(None)
    description: Optional[str] = Field(None, max_length=500)
    join_mode: Optional[str] = Field(None, description="'open' | 'approval'")


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


class GroupJoinRequestInfo(BaseModel):
    """Details of a user requesting to join an approval-based group."""
    user_id: str
    name: str
    username: str
    avatar: Optional[str] = None
    requested_at: Optional[datetime] = None


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
    description: Optional[str] = None
    join_mode: Optional[str] = "open"
    member_ids: List[str] = Field(default_factory=list)
    members: List[ConversationMemberInfo] = Field(default_factory=list)
    admins: List[str] = Field(default_factory=list)
    created_by: Optional[str] = None
    join_requests: List[GroupJoinRequestInfo] = Field(default_factory=list)
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
