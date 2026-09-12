"""
Authentication API endpoints.
Provides endpoints for registration, login, token refresh, logout, and profile retrieval.
Adheres strictly to the layer architecture: Route -> Service -> Repository -> MongoDB.
"""
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenRefreshRequest,
    TokenResponse,
    TokenRefreshResponse,
    UserResponse,
    LogoutResponse,
    SendOtpRequest,
    SendOtpResponse,
    VerifyOtpRequest,
    VerifyOtpResponse,
    LoginOtpRequest,
)
from app.services.auth_service import auth_service

router = APIRouter(prefix="", tags=["Authentication"])
security = HTTPBearer(auto_error=False)


@router.post(
    "/send-otp",
    response_model=SendOtpResponse,
    status_code=status.HTTP_200_OK,
    summary="Send SMS OTP via 2Factor",
    description="Dispatches a 6-digit SMS verification OTP to an Indian mobile number using 2Factor API.",
)
async def send_otp(payload: SendOtpRequest) -> SendOtpResponse:
    """Sends OTP via 2Factor API."""
    return await auth_service.send_otp(phone=payload.phone, purpose=payload.purpose)


@router.post(
    "/verify-otp",
    response_model=VerifyOtpResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify SMS OTP via 2Factor",
    description="Verifies the OTP against 2Factor API and returns a signed verification token.",
)
async def verify_otp(payload: VerifyOtpRequest) -> VerifyOtpResponse:
    """Verifies OTP via 2Factor API."""
    return await auth_service.verify_otp(
        session_id=payload.session_id, otp=payload.otp, phone=payload.phone
    )


@router.post(
    "/login-otp",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Login with Mobile OTP",
    description="Authenticates a user via verified 2Factor SMS OTP and returns standard JWT tokens.",
)
async def login_with_otp(payload: LoginOtpRequest) -> TokenResponse:
    """Logs user in using verified 2Factor OTP."""
    return await auth_service.login_with_otp(
        session_id=payload.session_id, otp=payload.otp, phone=payload.phone
    )


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
    description="Registers a new account, generates secure password hash, and returns JWT tokens.",
)
async def register(payload: UserRegisterRequest) -> TokenResponse:
    """Registers a new user and returns access + refresh tokens."""
    return await auth_service.register(payload)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="User Login",
    description="Authenticates credentials (email or username + password) and returns JWT tokens.",
)
async def login(payload: UserLoginRequest) -> TokenResponse:
    """Authenticates a user and issues new JWT tokens."""
    return await auth_service.login(payload)


@router.post(
    "/refresh",
    response_model=TokenRefreshResponse,
    status_code=status.HTTP_200_OK,
    summary="Refresh Access Token",
    description="Exchanges a valid refresh token for a new access token and rotated refresh token.",
)
async def refresh_token(payload: TokenRefreshRequest) -> TokenRefreshResponse:
    """Rotates refresh token and returns a new access token pair."""
    return await auth_service.refresh_token(payload.refresh_token)


@router.post(
    "/logout",
    response_model=LogoutResponse,
    status_code=status.HTTP_200_OK,
    summary="User Logout",
    description="Revokes access or refresh token so it cannot be used again.",
)
async def logout(
    payload: Optional[TokenRefreshRequest] = None,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> LogoutResponse:
    """Logs out by invalidating the bearer token or refresh token."""
    token_to_revoke = None
    if credentials and credentials.credentials:
        token_to_revoke = credentials.credentials
    elif payload and payload.refresh_token:
        token_to_revoke = payload.refresh_token

    if token_to_revoke:
        return await auth_service.logout(token_to_revoke)

    return LogoutResponse(status="ok", message="Successfully logged out.")


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Current User Profile",
    description="Fetches the authenticated user profile using the Bearer access token.",
)
async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> UserResponse:
    """Returns profile for currently authenticated user."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer access token in Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return await auth_service.get_current_user_from_token(credentials.credentials)
