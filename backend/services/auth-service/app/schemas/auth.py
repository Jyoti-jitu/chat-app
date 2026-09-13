"""
Authentication Pydantic schemas for request and response validation.
Decouples client-facing data contracts from internal database documents.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


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
    confirm_password: Optional[str] = Field(None, description="Password confirmation")
    phone: Optional[str] = Field(None, description="Verified mobile number (e.g. +919876543210)")
    verification_token: Optional[str] = Field(None, description="Cryptographic token proving mobile ownership")

    @field_validator("username")
    @classmethod
    def normalize_username(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

    @model_validator(mode="after")
    def verify_passwords_match(self) -> "UserRegisterRequest":
        if self.confirm_password is not None and self.password != self.confirm_password:
            raise ValueError("Passwords do not match. Password and confirm password must be identical.")
        return self


class SendOtpRequest(BaseModel):
    """Payload for requesting a 2Factor Voice Call or SMS OTP."""
    phone: str = Field(..., min_length=10, description="Recipient Indian mobile number")
    purpose: str = Field("register", pattern=r"^(register|login)$", description="Purpose: register or login")
    channel: str = Field("voice", pattern=r"^(sms|voice)$", description="Delivery channel: voice call or sms")


class SendOtpResponse(BaseModel):
    """Response returned upon 2Factor OTP dispatch."""
    status: str = "ok"
    message: str
    session_id: str
    phone: str
    expires_in: int
    resend_cooldown: int


class VerifyOtpRequest(BaseModel):
    """Payload for verifying 2Factor SMS OTP."""
    session_id: str = Field(..., min_length=1, description="2Factor session ID returned from send-otp")
    otp: str = Field(..., min_length=4, max_length=8, description="OTP code received via SMS")
    phone: str = Field(..., min_length=10, description="Mobile number associated with the OTP")


class VerifyOtpResponse(BaseModel):
    """Response returned upon successful OTP verification."""
    status: str = "ok"
    message: str
    phone: str
    verification_token: str


class LoginOtpRequest(BaseModel):
    """Payload for mobile OTP login."""
    session_id: str = Field(..., min_length=1, description="2Factor session ID")
    otp: str = Field(..., min_length=4, max_length=8, description="OTP code received via SMS")
    phone: str = Field(..., min_length=10, description="Mobile number")


class UserLoginRequest(BaseModel):
    """Payload for user authentication."""
    email: Optional[EmailStr] = Field(None, description="Registered email address")
    username: Optional[str] = Field(None, description="Registered username or mobile number")
    phone: Optional[str] = Field(None, description="Registered mobile number")
    password: str = Field(..., min_length=1, description="Account password")


class TokenRefreshRequest(BaseModel):
    """Payload for refreshing an expired access token."""
    refresh_token: str = Field(..., min_length=1, description="Valid refresh token")


class UserResponse(BaseModel):
    """Public user profile data."""
    id: str = Field(..., description="Unique user string ID")
    name: str
    username: str
    email: str
    phone: Optional[str] = None
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


class ChangePasswordRequest(BaseModel):
    """Payload for changing the authenticated user's password."""
    current_password: str = Field(..., min_length=1, description="Current account password")
    new_password: str = Field(..., min_length=6, max_length=128, description="New password (min 6 characters)")


class ChangePasswordResponse(BaseModel):
    """Response returned upon password change."""
    status: str = "ok"
    message: str = "Password changed successfully."

