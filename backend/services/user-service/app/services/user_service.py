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
        Sanitizes input, checks uniqueness for username, email, phone, and returns updated profile.
        """
        update_dict = updates.model_dump(exclude_unset=True)

        if not update_dict:
            return await self.get_my_profile(user_id)

        # Sanitize strings
        if "name" in update_dict and update_dict["name"]:
            update_dict["name"] = update_dict["name"].strip()
        if "bio" in update_dict and update_dict["bio"] is not None:
            update_dict["bio"] = update_dict["bio"].strip()
        if "website" in update_dict and update_dict["website"]:
            clean_website = update_dict["website"].strip()
            if clean_website and not clean_website.startswith(("http://", "https://")):
                clean_website = f"https://{clean_website}"
            update_dict["website"] = clean_website

        # Sanitize links list
        if "links" in update_dict and update_dict["links"] is not None:
            cleaned_links = []
            for item in update_dict["links"]:
                title = (item.get("title") if isinstance(item, dict) else getattr(item, "title", "Link")) or "Link"
                url = (item.get("url") if isinstance(item, dict) else getattr(item, "url", "")) or ""
                title = str(title).strip()
                url = str(url).strip()
                if url:
                    if not url.startswith(("http://", "https://")):
                        url = f"https://{url}"
                    cleaned_links.append({"title": title or "Link", "url": url})
            update_dict["links"] = cleaned_links
            if cleaned_links and not update_dict.get("website"):
                update_dict["website"] = cleaned_links[0]["url"]

        # Auto-upload avatar to Cloudinary if sent as Data URI
        if "avatar" in update_dict and update_dict["avatar"] and update_dict["avatar"].startswith("data:image/"):
            try:
                from shared.media.cloudinary_service import cloudinary_service
                uploaded = cloudinary_service.upload_base64_data_uri(update_dict["avatar"], folder="fluxchat/avatars")
                update_dict["avatar"] = uploaded.get("secure_url") or uploaded.get("url")
            except Exception as err:
                logger.warning(f"Cloudinary upload for avatar failed: {err}")

        # Auto-upload cover_image to Cloudinary if sent as Data URI
        if "cover_image" in update_dict and update_dict["cover_image"] and update_dict["cover_image"].startswith("data:image/"):
            try:
                from shared.media.cloudinary_service import cloudinary_service
                uploaded = cloudinary_service.upload_base64_data_uri(update_dict["cover_image"], folder="fluxchat/covers")
                update_dict["cover_image"] = uploaded.get("secure_url") or uploaded.get("url")
            except Exception as err:
                logger.warning(f"Cloudinary upload for cover_image failed: {err}")

        # Check username uniqueness if changed
        if "username" in update_dict and update_dict["username"]:
            clean_username = update_dict["username"].strip().lower()
            update_dict["username"] = clean_username
            existing = await self.repository.get_by_username(clean_username)
            if existing and existing["id"] != user_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This username is already taken. Please choose another.",
                )

        # Check email uniqueness if changed
        if "email" in update_dict and update_dict["email"]:
            clean_email = update_dict["email"].strip().lower()
            update_dict["email"] = clean_email
            existing = await self.repository.get_by_email(clean_email)
            if existing and existing["id"] != user_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An account with this email address already exists.",
                )

        # Check phone uniqueness if changed
        if "phone" in update_dict and update_dict["phone"]:
            clean_phone = update_dict["phone"].strip()
            update_dict["phone"] = clean_phone
            existing = await self.repository.get_by_phone(clean_phone)
            if existing and existing["id"] != user_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This mobile number is already registered with another account.",
                )

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
