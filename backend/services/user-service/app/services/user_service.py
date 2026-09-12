"""
User Service business logic layer.
Orchestrates profile validation, updates, search queries, and response transformations.
"""
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from app.core.logging import logger
from app.repositories.user_repository import UserRepository, user_repository
from app.schemas.user import (
    UserProfileResponse,
    UserProfileUpdate,
    UserPublicProfileResponse,
    UserSearchResponse,
)


class UserService:
    """Provides high-level business methods for user profile management and search."""

    def __init__(self, repository: UserRepository = user_repository):
        self.repository = repository

    async def get_my_profile(self, user_id: str) -> UserProfileResponse:
        """Retrieves full profile of the authenticated user."""
        user = await self.repository.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found.",
            )
        return UserProfileResponse(**user)

    async def update_my_profile(
        self, user_id: str, updates: UserProfileUpdate
    ) -> UserProfileResponse:
        """
        Updates fields provided in UserProfileUpdate.
        Sanitizes input and returns updated profile.
        """
        update_dict = updates.model_dump(exclude_unset=True)

        if not update_dict:
            return await self.get_my_profile(user_id)

        # Sanitize strings
        if "name" in update_dict and update_dict["name"]:
            update_dict["name"] = update_dict["name"].strip()
        if "bio" in update_dict and update_dict["bio"] is not None:
            update_dict["bio"] = update_dict["bio"].strip()

        updated_user = await self.repository.update_profile(user_id, update_dict)
        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found or update failed.",
            )

        logger.info(f"User profile updated successfully for user ID {user_id}")
        return UserProfileResponse(**updated_user)

    async def get_public_profile(self, target_user_id: str) -> UserPublicProfileResponse:
        """Retrieves public-facing profile of another user."""
        user = await self.repository.get_by_id(target_user_id)
        if not user or not user.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found or account is deactivated.",
            )
        return UserPublicProfileResponse(**user)

    async def search_users(
        self,
        query: Optional[str] = "",
        current_user_id: Optional[str] = None,
        limit: int = 50,
        skip: int = 0,
    ) -> UserSearchResponse:
        """
        Searches users matching query string. If query is empty, returns all active users.
        Excludes the searching user.
        """
        clean_query = (query or "").strip()

        # Enforce limits
        limit = max(1, min(limit, 100))
        skip = max(0, skip)

        users = await self.repository.search_users(
            query=clean_query,
            limit=limit,
            skip=skip,
            exclude_user_id=current_user_id,
        )
        total = await self.repository.count_search_users(
            query=clean_query,
            exclude_user_id=current_user_id,
        )

        items = [UserPublicProfileResponse(**u) for u in users]
        return UserSearchResponse(items=items, total=total, query=clean_query)


user_service = UserService()
