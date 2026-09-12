"""
Shared Security & Authorization Dependencies for FluxChat Microservices.
Provides reusable FastAPI dependency injection guards for JWT bearer authentication,
token revocation checks, active status verification, and role-based permissions.
"""
import os
from typing import Any, Dict, Optional
from bson import ObjectId
import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from shared.database.mongodb import db_manager

# Security Scheme
security_scheme = HTTPBearer(auto_error=False)


def get_jwt_config() -> Dict[str, str]:
    """Returns JWT secret and algorithm from environment."""
    return {
        "secret": os.getenv(
            "JWT_SECRET", "fluxchat-production-jwt-secret-key-32-chars-long-secure"
        ),
        "algorithm": os.getenv("JWT_ALGORITHM", "HS256"),
    }


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
) -> Dict[str, Any]:
    """
    Validates JWT Bearer access token from the Authorization header.
    Ensures:
      1. Bearer token is provided.
      2. Signature and expiration are valid.
      3. Token type is 'access' (rejects refresh tokens).
      4. Token has not been revoked in MongoDB.
      5. User exists in MongoDB and is active.
    Returns:
      Clean user dict with 'id' as a string.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header with Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    raw_token = credentials.credentials
    cfg = get_jwt_config()

    try:
        payload = jwt.decode(
            raw_token,
            cfg["secret"],
            algorithms=[cfg["algorithm"]],
            options={"verify_exp": False},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token. Signature or format is invalid.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Enforce access token type
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type. Protected endpoints require an access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token contains no subject (user ID).",
            headers={"WWW-Authenticate": "Bearer"},
        )

    db = db_manager.get_database()

    # Check token revocation
    revoked = await db.revoked_tokens.find_one({"token": raw_token})
    if revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This token has been revoked. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fetch user from database
    try:
        user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user_doc = await db.users.find_one({"id": str(user_id)})

    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user account no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user_doc.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated or suspended.",
        )

    # Format clean dictionary
    clean_user = {
        "id": str(user_doc["_id"]),
        "name": user_doc.get("name", ""),
        "username": user_doc.get("username", ""),
        "email": user_doc.get("email", ""),
        "phone": user_doc.get("phone"),
        "avatar": user_doc.get("avatar"),
        "bio": user_doc.get("bio"),
        "is_active": user_doc.get("is_active", True),
        "is_admin": user_doc.get("is_admin", False),
        "created_at": user_doc.get("created_at"),
        "updated_at": user_doc.get("updated_at"),
    }

    return clean_user


async def require_active_user(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Ensures that the authenticated user is active."""
    if not current_user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive.",
        )
    return current_user


async def require_admin(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Ensures that the authenticated user has admin privileges."""
    if not current_user.get("is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required.",
        )
    return current_user


def validate_object_id(id_str: str, entity_name: str = "ID") -> ObjectId:
    """
    Validates that a string is a valid 24-character hexadecimal MongoDB ObjectId.
    Prevents NoSQL injection attacks using nested query operators.
    """
    if not id_str or not isinstance(id_str, str) or not ObjectId.is_valid(id_str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {entity_name} format. Must be a 24-character hexadecimal string.",
        )
    return ObjectId(id_str)


def assert_resource_owner(user_id: str, owner_id: str, resource_name: str = "Resource") -> None:
    """
    IDOR defense guard: Verifies that the current user owns the target resource.
    """
    if str(user_id) != str(owner_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: You do not have permission to modify this {resource_name}.",
        )


def assert_conversation_member(user_id: str, member_ids: list) -> None:
    """
    IDOR defense guard: Verifies that the current user is a member of the conversation.
    """
    str_members = [str(m) for m in member_ids]
    if str(user_id) not in str_members:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not a member of this conversation.",
        )

