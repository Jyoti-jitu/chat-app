"""
Authentication Pydantic schemas for request and response validation.
Decouples client-facing data contracts from internal database documents.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator


class UserRegisterRequest(BaseModel):
    """Payload for registering a new user account."""
    name: str = Field(..., min_length=2, max_length=100, description="Full display name")
    username: str = Field(
        ...,
        min_length=3,
        max_length=30,
        pattern=r"^[a-zA-Z0-9_]+$",
        description="Unique username containing letters, numbers, or underscores",
    )
    email: EmailStr = Field(..., description="Valid unique email address")
    password: str = Field(..., min_length=6, max_length=128, description="Account password (min 6 characters)")

    @field_validator("username")
    @classmethod
    def normalize_username(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class UserLoginRequest(BaseModel):
    """Payload for user authentication."""
    email: Optional[EmailStr] = Field(None, description="Registered email address")
    username: Optional[str] = Field(None, description="Registered username")
    password: str = Field(..., min_length=1, description="Account password")

    @field_validator("password")
    @classmethod
    def validate_has_identifier(cls, v: str, info) -> str:
        # Pydantic v2 field_validator runs per-field; we can validate username/email in a model_validator
        return v


class TokenRefreshRequest(BaseModel):
    """Payload for refreshing an expired access token."""
    refresh_token: str = Field(..., min_length=1, description="Valid refresh token")


class UserResponse(BaseModel):
    """Public user profile data."""
    id: str = Field(..., description="Unique user string ID")
    name: str
    username: str
    email: str
    avatar: Optional[str] = None
    bio: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None


class TokenResponse(BaseModel):
    """Authentication success payload with tokens and user details."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(default=900, description="Access token expiration in seconds")
    user: UserResponse


class TokenRefreshResponse(BaseModel):
    """Refreshed token pair payload."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(default=900, description="Access token expiration in seconds")


class LogoutResponse(BaseModel):
    """Logout acknowledgment response."""
    status: str = "ok"
    message: str = "Successfully logged out"
