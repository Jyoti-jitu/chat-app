"""
User profile and discovery API routes for FluxChat.
Protected with shared JWT authorization dependency.
"""
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query, status
from app.schemas.user import (
    UserProfileResponse,
    UserProfileUpdate,
    UserPublicProfileResponse,
    UserSearchResponse,
)
from app.services.user_service import user_service
from shared.security.dependencies import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])


@router.get(
    "/me",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Current User Profile",
    description="Fetches full profile information for the authenticated user.",
)
async def get_my_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> UserProfileResponse:
    """Returns authenticated user's private profile."""
    return await user_service.get_my_profile(current_user["id"])


@router.patch(
    "/me",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Profile",
    description="Updates display name, bio, or avatar for the authenticated user.",
)
async def update_my_profile(
    payload: UserProfileUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> UserProfileResponse:
    """Updates user profile and returns updated document."""
    return await user_service.update_my_profile(current_user["id"], payload)


@router.get(
    "/search",
    response_model=UserSearchResponse,
    status_code=status.HTTP_200_OK,
    summary="Search Users",
    description="Searches users across username, name, email, or phone. Excludes current user. If query is empty, returns all registered users.",
)
async def search_users(
    q: Optional[str] = Query(default="", max_length=50, description="Search query string. If empty, lists all registered users."),
    limit: int = Query(50, ge=1, le=100, description="Max results to return"),
    skip: int = Query(0, ge=0, description="Results offset for pagination"),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> UserSearchResponse:
    """Searches directory of active users or lists all registered users."""
    return await user_service.search_users(
        query=q or "",
        current_user_id=current_user["id"],
        limit=limit,
        skip=skip,
    )


@router.get(
    "/{user_id}",
    response_model=UserPublicProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Get User Public Profile",
    description="Retrieves public profile for any user by user ID.",
)
async def get_public_profile(
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> UserPublicProfileResponse:
    """Returns sanitized public profile for target user."""
    return await user_service.get_public_profile(user_id)
