"""
User profile schemas for request validation and response serialization.
Decouples client contracts from MongoDB database documents.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field


class UserProfileUpdate(BaseModel):
    """Payload for updating authenticated user's profile details."""
    name: Optional[str] = Field(None, min_length=2, max_length=100, description="Full display name")
    bio: Optional[str] = Field(None, max_length=250, description="Short personal bio or status message")
    avatar: Optional[str] = Field(None, max_length=1000, description="Avatar image URL or base64 data URI")
    phone: Optional[str] = Field(None, description="Updated phone number")


class UserProfileResponse(BaseModel):
    """Complete private profile response for the authenticated user."""
    id: str
    name: str
    username: str
    email: EmailStr
    phone: Optional[str] = None
    avatar: Optional[str] = None
    bio: Optional[str] = None
    is_active: bool = True
    is_online: bool = False
    last_seen: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class UserPublicProfileResponse(BaseModel):
    """Sanitized public profile response visible to other users."""
    id: str
    name: str
    username: str
    avatar: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    is_online: bool = False
    last_seen: Optional[datetime] = None


class UserSearchResponse(BaseModel):
    """Paginated search response for user discovery."""
    items: List[UserPublicProfileResponse]
    total: int
    query: str
