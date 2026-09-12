"""
Pydantic schemas for Contact and Connection Request operations.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.user import UserPublicProfileResponse


class SendContactRequest(BaseModel):
    """Payload for initiating a connection request to another user."""
    recipient_id: Optional[str] = Field(None, description="Direct recipient user ID")
    identifier: Optional[str] = Field(
        None, description="Recipient username, email, or mobile number"
    )


class ContactRequestResponse(BaseModel):
    """Details of a single connection request."""
    id: str
    sender_id: str
    recipient_id: str
    status: str
    sender: Optional[UserPublicProfileResponse] = None
    recipient: Optional[UserPublicProfileResponse] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ContactRequestListResponse(BaseModel):
    """Grouped connection requests for the authenticated user."""
    received: List[ContactRequestResponse]
    sent: List[ContactRequestResponse]


class ContactItemResponse(BaseModel):
    """A contact in the authenticated user's roster."""
    id: str
    contact_id: str
    user: UserPublicProfileResponse
    created_at: Optional[datetime] = None


class ContactListResponse(BaseModel):
    """List of all confirmed contacts."""
    items: List[ContactItemResponse]
    total: int


class ActionSuccessResponse(BaseModel):
    """Generic action acknowledgment response."""
    status: str = "ok"
    message: str
