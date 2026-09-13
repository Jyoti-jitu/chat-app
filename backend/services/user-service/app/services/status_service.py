"""
Status Service for managing 24-hour Status / Stories.
Guarantees 24h expiration and contact-only privacy.
"""
from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, List
from fastapi import HTTPException, status

from app.repositories.status_repository import status_repository
from app.repositories.contact_repository import contact_repository
from app.repositories.user_repository import user_repository
from app.schemas.status import (
    ActionSuccessResponse,
    CreateStatusPayload,
    StatusFeedResponse,
    StatusSlideResponse,
    UserStatusResponse,
)
from shared.media.cloudinary_service import cloudinary_service

logger = logging.getLogger("FluxChat.UserService.Status")


def _format_initials(name: str) -> str:
    parts = name.strip().split()
    if not parts:
        return "ME"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return f"{parts[0][0]}{parts[-1][0]}".upper()


class StatusService:
    """Business logic for 24-hour status stories."""

    def __init__(self):
        self.repo = status_repository
        self.contact_repo = contact_repository
        self.user_repo = user_repository

    async def create_status(
        self, current_user_id: str, payload: CreateStatusPayload
    ) -> StatusSlideResponse:
        """
        Creates a new status slide with exactly 24 hours of lifetime.
        If photo is uploaded as a base64 / data URI, uploads directly to Cloudinary.
        """
        # Fetch user details for metadata
        user_doc = await self.user_repo.find_by_id(current_user_id)
        user_name = user_doc.get("name") or user_doc.get("username") or "User"
        user_avatar = user_doc.get("avatar")

        content = payload.content.strip()
        slide_type = payload.type.lower()

        # If image is a data URI, auto-upload to Cloudinary
        if slide_type == "image" and content.startswith("data:image/"):
            try:
                uploaded = cloudinary_service.upload_base64_data_uri(
                    content, folder="fluxchat/status"
                )
                content = uploaded.get("secure_url") or uploaded.get("url")
            except Exception as err:
                logger.warning(f"Cloudinary upload for status photo failed: {err}")

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=24)

        doc_data = {
            "user_id": current_user_id,
            "user_name": user_name,
            "user_avatar": user_avatar,
            "type": slide_type,
            "content": content,
            "caption": payload.caption.strip() if payload.caption else None,
            "background_color": payload.background_color,
            "font_style": payload.font_style or "modern",
            "created_at": now,
            "expires_at": expires_at,
        }

        created = await self.repo.create_slide(doc_data)
        logger.info(f"User [{current_user_id}] posted 24h status slide [{created['id']}]")

        return StatusSlideResponse(
            id=created["id"],
            type=created["type"],
            content=created["content"],
            caption=created.get("caption"),
            background_color=created.get("background_color"),
            font_style=created.get("font_style"),
            created_at=created["created_at"],
            expires_at=created["expires_at"],
        )

    async def get_status_feed(self, current_user_id: str) -> StatusFeedResponse:
        """
        Retrieves active status stories visible to the caller:
        Strictly the user's own statuses AND their accepted contacts' statuses.
        """
        # 1. Fetch confirmed bilateral contacts
        contacts = await self.contact_repo.get_contacts_for_user(current_user_id)
        contact_ids = [str(c["contact_id"]) for c in contacts if c.get("contact_id")]

        # 2. Allowed user IDs = current user + confirmed contacts
        allowed_user_ids = list(dict.fromkeys([current_user_id] + contact_ids))

        # 3. Query all non-expired slides for these users
        raw_slides = await self.repo.find_active_statuses_by_users(allowed_user_ids)

        # 4. Group slides by user
        user_groups: Dict[str, List[Dict[str, Any]]] = {}
        for s in raw_slides:
            uid = s["user_id"]
            if uid not in user_groups:
                user_groups[uid] = []
            user_groups[uid].append(s)

        feed_items: List[UserStatusResponse] = []

        # Current user's status first if present
        all_uids = list(user_groups.keys())
        if current_user_id in all_uids:
            all_uids.remove(current_user_id)
            all_uids.insert(0, current_user_id)

        for uid in all_uids:
            slides_for_user = user_groups[uid]
            if not slides_for_user:
                continue

            first = slides_for_user[0]
            user_name = first.get("user_name") or "User"
            user_avatar = first.get("user_avatar")
            user_initials = _format_initials(user_name)
            is_me = uid == current_user_id

            # Sort slides chronologically (oldest to newest) for story playback
            sorted_slides = sorted(slides_for_user, key=lambda x: x["created_at"])
            last_updated = sorted_slides[-1]["created_at"]

            slide_responses = [
                StatusSlideResponse(
                    id=s["id"],
                    type=s["type"],
                    content=s["content"],
                    caption=s.get("caption"),
                    background_color=s.get("background_color"),
                    font_style=s.get("font_style"),
                    created_at=s["created_at"],
                    expires_at=s["expires_at"],
                )
                for s in sorted_slides
            ]

            feed_items.append(
                UserStatusResponse(
                    id=f"status_{uid}",
                    user_id=uid,
                    user_name=user_name,
                    user_avatar=user_avatar,
                    user_initials=user_initials,
                    is_me=is_me,
                    slides=slide_responses,
                    viewed=False,
                    last_updated=last_updated,
                )
            )

        return StatusFeedResponse(items=feed_items, total=len(feed_items))

    async def delete_slide(
        self, current_user_id: str, slide_id: str
    ) -> ActionSuccessResponse:
        """Deletes a specific status slide owned by caller."""
        slide = await self.repo.find_slide_by_id(slide_id)
        if not slide:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Status slide not found.",
            )

        if slide.get("user_id") != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own status slides.",
            )

        deleted = await self.repo.delete_slide(slide_id, current_user_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not delete slide.",
            )

        return ActionSuccessResponse(status="ok", message="Slide deleted successfully.")

    async def delete_my_statuses(self, current_user_id: str) -> ActionSuccessResponse:
        """Deletes all active status slides for the current user."""
        count = await self.repo.delete_all_user_slides(current_user_id)
        return ActionSuccessResponse(
            status="ok",
            message=f"Deleted {count} status slide(s).",
        )


status_service = StatusService()
