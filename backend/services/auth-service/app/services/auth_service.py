"""
Auth business logic layer.
Orchestrates password hashing, token lifecycle, domain validation, and repository access.
Contains no raw database queries.
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException, status
from app.core.jwt import JWTService
from app.core.security import PasswordHasher
from app.core.logging import logger
from app.core.config import settings
from app.models.user import UserModel
from app.repositories.auth_repository import auth_repository
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    TokenRefreshResponse,
    UserResponse,
    LogoutResponse,
)


class AuthService:
    """Encapsulates business operations for user authentication and authorization."""

    def __init__(self, repository=auth_repository):
        self.repository = repository

    async def register(self, request: UserRegisterRequest) -> TokenResponse:
        """
        Registers a new user after verifying unique email and username.
        Hashes password securely and generates initial token pair.
        """
        # Verify unique email
        existing_email = await self.repository.get_by_email(request.email)
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email address already exists.",
            )

        # Verify unique username
        existing_username = await self.repository.get_by_username(request.username)
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This username is already taken. Please choose another.",
            )

        # Hash password securely
        password_hash = PasswordHasher.hash_password(request.password)

        # Create user document
        user_doc = UserModel.create_document(
            name=request.name,
            username=request.username,
            email=request.email,
            password_hash=password_hash,
        )

        saved_user = await self.repository.create_user(user_doc)
        user_id = str(saved_user["_id"])

        logger.info(f"Registered new user '{request.username}' with ID: {user_id}")

        # Issue access and refresh tokens
        access_token = JWTService.create_access_token(
            user_id=user_id,
            email=saved_user["email"],
            username=saved_user["username"],
        )
        refresh_token = JWTService.create_refresh_token(user_id=user_id)

        clean_user = UserModel.to_dict(saved_user)
        user_response = UserResponse(**clean_user)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user_response,
        )

    async def login(self, request: UserLoginRequest) -> TokenResponse:
        """
        Authenticates a user with email/username and password.
        Returns JWT access and refresh token pair upon successful verification.
        """
        identifier = request.email or request.username
        if not identifier:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either email or username must be provided.",
            )

        user = await self.repository.get_by_email_or_username(str(identifier))
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials. Please verify your email/username and password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Verify password hash
        if not PasswordHasher.verify_password(request.password, user.get("password_hash", "")):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials. Please verify your email/username and password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Verify account active status
        if not user.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is currently deactivated. Please contact support.",
            )

        user_id = str(user["_id"])
        await self.repository.update_last_login(user_id)

        logger.info(f"User '{user.get('username')}' logged in successfully.")

        # Generate tokens
        access_token = JWTService.create_access_token(
            user_id=user_id,
            email=user["email"],
            username=user["username"],
        )
        refresh_token = JWTService.create_refresh_token(user_id=user_id)

        clean_user = UserModel.to_dict(user)
        user_response = UserResponse(**clean_user)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user_response,
        )

    async def refresh_token(self, refresh_token_str: str) -> TokenRefreshResponse:
        """
        Validates refresh token, invalidates old token, and rotates in a new token pair.
        """
        payload = JWTService.decode_token(refresh_token_str)

        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type. Expected a refresh token.",
            )

        # Check if already revoked
        if await self.repository.is_token_revoked(refresh_token_str):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has been invalidated. Please log in again.",
            )

        user_id = payload.get("sub")
        user = await self.repository.get_by_id(user_id)
        if not user or not user.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account not found or disabled.",
            )

        # Invalidate old refresh token (Token Rotation)
        exp_timestamp = payload.get("exp", int(datetime.now(timezone.utc).timestamp()))
        exp_dt = datetime.fromtimestamp(exp_timestamp, timezone.utc)
        await self.repository.revoke_token(refresh_token_str, exp_dt)

        # Generate fresh token pair
        new_access_token = JWTService.create_access_token(
            user_id=user_id,
            email=user["email"],
            username=user["username"],
        )
        new_refresh_token = JWTService.create_refresh_token(user_id=user_id)

        logger.info(f"Token pair refreshed for user ID {user_id}")

        return TokenRefreshResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def logout(self, token_str: str) -> LogoutResponse:
        """Revokes a given access or refresh token upon user logout."""
        try:
            payload = JWTService.decode_token(token_str)
            exp_timestamp = payload.get("exp", int(datetime.now(timezone.utc).timestamp()))
            exp_dt = datetime.fromtimestamp(exp_timestamp, timezone.utc)
            await self.repository.revoke_token(token_str, exp_dt)
        except Exception:
            # Even if token is already expired or malformed, proceed gracefully
            pass

        return LogoutResponse(status="ok", message="Successfully logged out.")

    async def get_current_user_from_token(self, token: str) -> UserResponse:
        """Validates an access token and returns the corresponding authenticated user."""
        payload = JWTService.decode_token(token)

        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type. Expected access token.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if await self.repository.is_token_revoked(token):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user_id = payload.get("sub")
        user = await self.repository.get_by_id(user_id)
        if not user or not user.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        clean_user = UserModel.to_dict(user)
        return UserResponse(**clean_user)


auth_service = AuthService()
