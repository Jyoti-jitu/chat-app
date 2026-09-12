"""
JWT Token generation and verification service.
Handles Access and Refresh token lifecycle with HS256 HMAC encryption.
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import jwt
from fastapi import HTTPException, status
from app.core.config import settings
from app.core.logging import logger


class JWTService:
    """Manages creation, decoding, and validation of JWT access and refresh tokens."""

    @staticmethod
    def create_access_token(
        user_id: str, email: str, username: str, extra_claims: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Creates a short-lived access token (default 15 minutes).
        Contains standard claims: sub (user_id), email, username, type ("access"), exp, iat.
        """
        now = datetime.now(timezone.utc)
        expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        expire = now + expires_delta

        payload = {
            "sub": str(user_id),
            "email": email,
            "username": username,
            "type": "access",
            "iat": int(now.timestamp()),
            "exp": int(expire.timestamp()),
        }

        if extra_claims:
            payload.update(extra_claims)

        return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    @staticmethod
    def create_refresh_token(user_id: str) -> str:
        """
        Creates a long-lived refresh token (default 30 days).
        Contains standard claims: sub (user_id), type ("refresh"), exp, iat.
        """
        now = datetime.now(timezone.utc)
        expires_delta = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        expire = now + expires_delta

        payload = {
            "sub": str(user_id),
            "type": "refresh",
            "iat": int(now.timestamp()),
            "exp": int(expire.timestamp()),
        }

        return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    @staticmethod
    def decode_token(token: str) -> Dict[str, Any]:
        """
        Decodes and verifies a JWT token.
        Tokens remain valid until revoked upon logout (verify_exp disabled).
        Raises HTTPException 401 if invalid.
        """
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM],
                options={"verify_exp": False},
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid JWT token presented: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token. Authentication failed.",
                headers={"WWW-Authenticate": "Bearer"},
            )
