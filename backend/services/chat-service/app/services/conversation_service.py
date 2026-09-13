from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import httpx
from fastapi import HTTPException, status
from app.core.logging import logger
from app.repositories.conversation_repository import (
    conversation_repository,
    _to_object_id,
)
from shared.database.mongodb import db_manager
from app.schemas.conversation import (
    ActionSuccessResponse,
    AddMembersPayload,
    ConversationListResponse,
    ConversationMemberInfo,
    ConversationResponse,
    CreateDirectConversation,
    CreateGroupConversation,
    GroupJoinRequestInfo,
    LastMessageInfo,
    UpdateGroupConversation,
    UpdateGroupSettingsPayload,
)


class ConversationService:
    """Business logic for conversation management."""

    def __init__(self):
        self.repo = conversation_repository

    async def _hydrate_conversation(
        self, conv: Dict[str, Any], current_user_id: str
    ) -> ConversationResponse:
        """
        Hydrates conversation member IDs into rich profile objects and formats
        display names, avatars, join modes, and admin join requests dynamically.
        """
        member_ids = conv.get("members", [])
        profiles_map = await self.repo.get_users_profiles(member_ids)

        members_list: List[ConversationMemberInfo] = []
        for mid in member_ids:
            p = profiles_map.get(str(mid))
            if p:
                members_list.append(
                    ConversationMemberInfo(
                        id=str(mid),
                        name=p.get("name", "FluxChat User"),
                        username=p.get("username", "user"),
                        avatar=p.get("avatar"),
                        is_online=p.get("is_online", False),
                        last_seen=p.get("last_seen"),
                    )
                )
            else:
                members_list.append(
                    ConversationMemberInfo(
                        id=str(mid),
                        name="FluxChat User",
                        username="user",
                        avatar=None,
                        is_online=False,
                    )
                )

        conv_type = conv.get("type", "direct")
        name = conv.get("name")
        avatar = conv.get("avatar")

        # For direct chats, the title and avatar should display the other participant
        if conv_type == "direct":
            other_members = [m for m in members_list if m.id != current_user_id]
            if other_members:
                name = other_members[0].name
                avatar = other_members[0].avatar
            elif members_list:
                name = members_list[0].name
                avatar = members_list[0].avatar

        last_msg_doc = conv.get("last_message")
        last_msg = None
        if last_msg_doc and isinstance(last_msg_doc, dict):
            last_msg = LastMessageInfo(
                id=last_msg_doc.get("id"),
                sender_id=last_msg_doc.get("sender_id"),
                sender_name=last_msg_doc.get("sender_name"),
                content=last_msg_doc.get("content"),
                timestamp=last_msg_doc.get("timestamp"),
            )

        # Hydrate join requests for group admins
        admins_list = [str(a) for a in conv.get("admins", [])]
        is_admin = current_user_id in admins_list or str(conv.get("created_by")) == current_user_id
        join_requests_data: List[GroupJoinRequestInfo] = []
        if is_admin and conv.get("join_requests"):
            for req in conv.get("join_requests", []):
                join_requests_data.append(
                    GroupJoinRequestInfo(
                        user_id=str(req.get("user_id")),
                        name=req.get("name", "User"),
                        username=req.get("username", "user"),
                        avatar=req.get("avatar"),
                        requested_at=req.get("requested_at"),
                    )
                )

        return ConversationResponse(
            id=conv["id"],
            type=conv_type,
            name=name,
            avatar=avatar,
            description=conv.get("description"),
            join_mode=conv.get("join_mode", "open"),
            member_ids=[str(m) for m in member_ids],
            members=members_list,
            admins=admins_list,
            created_by=str(conv.get("created_by", "")),
            join_requests=join_requests_data,
            last_message=last_msg,
            unread_count=conv.get("unread_count", 0),
            created_at=conv.get("created_at"),
            updated_at=conv.get("updated_at"),
        )

    async def get_or_create_direct_conversation(
        self, current_user_id: str, payload: CreateDirectConversation
    ) -> ConversationResponse:
        """
        Retrieves existing 1:1 conversation or creates a new direct conversation thread.
        Guarantees deduplication between any pair of users.
        """
        recipient_id = payload.recipient_id.strip()
        if current_user_id == recipient_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot start a direct conversation with yourself.",
            )

        # Check existing conversation
        existing = await self.repo.find_direct_conversation(
            current_user_id, recipient_id
        )
        if existing:
            if "cleared_by" in existing and current_user_id in existing.get("cleared_by", []):
                oid = _to_object_id(existing["id"])
                await self.repo.conversations.update_one(
                    {"$or": [{"_id": oid}, {"_id": existing["id"]}]},
                    {"$pull": {"cleared_by": current_user_id}},
                )
                existing["cleared_by"] = [
                    u for u in existing.get("cleared_by", []) if u != current_user_id
                ]
            return await self._hydrate_conversation(existing, current_user_id)

        # Create new direct conversation
        conv_data = {
            "type": "direct",
            "name": None,
            "avatar": None,
            "members": [current_user_id, recipient_id],
            "admins": [current_user_id, recipient_id],
            "created_by": current_user_id,
            "unread_count": 0,
        }
        created = await self.repo.create_conversation(conv_data)
        logger.info(
            f"Created new direct conversation [{created['id']}] between {current_user_id} and {recipient_id}"
        )
        return await self._hydrate_conversation(created, current_user_id)

    async def create_group_conversation(
        self, current_user_id: str, payload: CreateGroupConversation
    ) -> ConversationResponse:
        """Creates a new group conversation with the creator as initial admin."""
        # Include current user in members automatically
        unique_members = list(
            dict.fromkeys([current_user_id] + [m.strip() for m in payload.member_ids if m.strip()])
        )

        avatar = payload.avatar
        if avatar and avatar.startswith("data:image/"):
            try:
                from shared.media.cloudinary_service import cloudinary_service
                uploaded = cloudinary_service.upload_base64_data_uri(avatar, folder="fluxchat/groups")
                avatar = uploaded.get("secure_url") or uploaded.get("url")
            except Exception as err:
                logger.warning(f"Failed to upload group avatar to Cloudinary: {err}")

        conv_data = {
            "type": "group",
            "name": payload.name.strip(),
            "avatar": avatar,
            "description": payload.description.strip() if payload.description else None,
            "join_mode": payload.join_mode or "open",
            "members": unique_members,
            "admins": [current_user_id],
            "created_by": current_user_id,
            "join_requests": [],
            "unread_count": 0,
        }
        created = await self.repo.create_conversation(conv_data)
        logger.info(
            f"Created group conversation [{created['id']}] '{payload.name}' by user {current_user_id}"
        )
        return await self._hydrate_conversation(created, current_user_id)

    async def list_user_conversations(
        self, current_user_id: str, limit: int = 50, skip: int = 0
    ) -> ConversationListResponse:
        """Returns all conversations the user is currently a member of."""
        raw_items = await self.repo.find_user_conversations(
            current_user_id, limit=limit, skip=skip
        )
        total = await self.repo.count_user_conversations(current_user_id)

        hydrated_items: List[ConversationResponse] = []
        for item in raw_items:
            hydrated_items.append(
                await self._hydrate_conversation(item, current_user_id)
            )

        return ConversationListResponse(items=hydrated_items, total=total)

    async def get_conversation(
        self, current_user_id: str, conversation_id: str
    ) -> ConversationResponse:
        """Retrieves a single conversation, verifying caller membership."""
        conv = None
        if conversation_id.startswith("c_"):
            recipient_id = conversation_id[2:]
            conv = await self.repo.find_direct_conversation(current_user_id, recipient_id)
        if not conv:
            conv = await self.repo.find_by_id(conversation_id)

        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        members = [str(m) for m in conv.get("members", [])]
        if current_user_id not in members and str(conv.get("created_by")) != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this conversation.",
            )

        return await self._hydrate_conversation(conv, current_user_id)

    async def join_conversation(
        self, current_user_id: str, conversation_id: str
    ) -> Dict[str, Any]:
        """
        Allows a user to join an open group or submit a join request if admin approval is required.
        """
        conv = await self.repo.find_by_id(conversation_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        if conv.get("type") != "group":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot join a direct 1:1 conversation.",
            )

        members = [str(m) for m in conv.get("members", [])]
        if current_user_id in members:
            hydrated = await self._hydrate_conversation(conv, current_user_id)
            return {"status": "already_member", "conversation": hydrated.model_dump(mode="json")}

        join_mode = conv.get("join_mode", "open")

        if join_mode == "open":
            # Direct join
            updated = await self.repo.add_members(conversation_id, [current_user_id])
            await self._dispatch_realtime_event(
                "group.member_joined",
                {"conversation_id": conversation_id, "user_id": current_user_id},
                conversation_id,
                conv.get("members", []) + [current_user_id],
                current_user_id,
            )
            hydrated = await self._hydrate_conversation(updated or conv, current_user_id)
            return {
                "status": "joined",
                "message": "Successfully joined group.",
                "conversation": hydrated.model_dump(mode="json"),
            }
        else:
            # Approval required: save join request
            profiles = await self.repo.get_users_profiles([current_user_id])
            prof = profiles.get(current_user_id, {})
            req_data = {
                "user_id": current_user_id,
                "name": prof.get("name", "User"),
                "username": prof.get("username", "user"),
                "avatar": prof.get("avatar"),
                "requested_at": datetime.now(timezone.utc),
            }
            await self.repo.add_join_request(conversation_id, req_data)

            # Notify group admins via real-time event
            admins = [str(a) for a in conv.get("admins", [])]
            await self._dispatch_realtime_event(
                "group.join_requested",
                {"conversation_id": conversation_id, "request": req_data},
                conversation_id,
                admins,
                current_user_id,
            )
            return {
                "status": "pending_approval",
                "message": "Join request submitted. Awaiting group admin approval.",
            }

    async def get_join_requests(
        self, current_user_id: str, conversation_id: str
    ) -> List[Dict[str, Any]]:
        """Returns pending join requests for a group (Admin only)."""
        conv = await self.repo.find_by_id(conversation_id)
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

        admins = [str(a) for a in conv.get("admins", [])]
        if current_user_id not in admins and str(conv.get("created_by")) != current_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin authorization required.")

        return conv.get("join_requests", [])

    async def approve_join_request(
        self, current_user_id: str, conversation_id: str, target_user_id: str
    ) -> ConversationResponse:
        """Approve a user's join request, adding them as a member (Admin only)."""
        conv = await self.repo.find_by_id(conversation_id)
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

        admins = [str(a) for a in conv.get("admins", [])]
        if current_user_id not in admins and str(conv.get("created_by")) != current_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin authorization required.")

        # Remove from join requests and add to members
        await self.repo.remove_join_request(conversation_id, target_user_id)
        updated = await self.repo.add_members(conversation_id, [target_user_id])

        members = [str(m) for m in (updated or conv).get("members", [])]
        await self._dispatch_realtime_event(
            "group.request_approved",
            {"conversation_id": conversation_id, "user_id": target_user_id},
            conversation_id,
            members,
            current_user_id,
        )

        return await self._hydrate_conversation(updated or conv, current_user_id)

    async def reject_join_request(
        self, current_user_id: str, conversation_id: str, target_user_id: str
    ) -> ActionSuccessResponse:
        """Reject and remove a user's join request (Admin only)."""
        conv = await self.repo.find_by_id(conversation_id)
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

        admins = [str(a) for a in conv.get("admins", [])]
        if current_user_id not in admins and str(conv.get("created_by")) != current_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin authorization required.")

        await self.repo.remove_join_request(conversation_id, target_user_id)
        return ActionSuccessResponse(status="ok", message="Join request rejected.")

    async def update_group_settings(
        self,
        current_user_id: str,
        conversation_id: str,
        payload: UpdateGroupSettingsPayload,
    ) -> ConversationResponse:
        """Updates group join mode, avatar, description, or name (Admin only)."""
        conv = await self.repo.find_by_id(conversation_id)
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

        if conv.get("type") != "group":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only groups have settings.")

        admins = [str(a) for a in conv.get("admins", [])]
        if current_user_id not in admins and str(conv.get("created_by")) != current_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin authorization required.")

        updates: Dict[str, Any] = {}
        if payload.name is not None:
            updates["name"] = payload.name.strip()
        if payload.description is not None:
            updates["description"] = payload.description.strip()
        if payload.join_mode is not None:
            updates["join_mode"] = payload.join_mode
        if payload.avatar is not None:
            avatar = payload.avatar
            if avatar.startswith("data:image/"):
                try:
                    from shared.media.cloudinary_service import cloudinary_service
                    uploaded = cloudinary_service.upload_base64_data_uri(avatar, folder="fluxchat/groups")
                    avatar = uploaded.get("secure_url") or uploaded.get("url")
                except Exception as err:
                    logger.warning(f"Group avatar Cloudinary upload failed: {err}")
            updates["avatar"] = avatar

        if updates:
            updated = await self.repo.update_group_info(conversation_id, updates)
            if updated:
                conv = updated

        return await self._hydrate_conversation(conv, current_user_id)

    async def promote_to_admin(
        self, current_user_id: str, conversation_id: str, target_user_id: str
    ) -> ConversationResponse:
        """Promotes an existing member to admin (Admin only)."""
        conv = await self.repo.find_by_id(conversation_id)
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

        admins = [str(a) for a in conv.get("admins", [])]
        if current_user_id not in admins and str(conv.get("created_by")) != current_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin authorization required.")

        members = [str(m) for m in conv.get("members", [])]
        if target_user_id not in members:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Target is not a member of the group.")

        updated = await self.repo.add_admin(conversation_id, target_user_id)
        return await self._hydrate_conversation(updated or conv, current_user_id)

    async def update_group_conversation(
        self,
        current_user_id: str,
        conversation_id: str,
        payload: UpdateGroupConversation,
    ) -> ConversationResponse:
        """Updates group name or avatar. Enforces that caller is an admin."""
        settings_payload = UpdateGroupSettingsPayload(
            name=payload.name,
            avatar=payload.avatar,
            description=payload.description,
            join_mode=payload.join_mode,
        )
        return await self.update_group_settings(current_user_id, conversation_id, settings_payload)

    async def add_members(
        self,
        current_user_id: str,
        conversation_id: str,
        payload: AddMembersPayload,
    ) -> ConversationResponse:
        """Adds members to a group conversation."""
        conv = await self.repo.find_by_id(conversation_id)
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

        if conv.get("type") != "group":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Members cannot be added to a direct chat.")

        members = [str(m) for m in conv.get("members", [])]
        if current_user_id not in members:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You must be a member of this conversation.")

        clean_ids = [m.strip() for m in payload.member_ids if m.strip()]
        updated = await self.repo.add_members(conversation_id, clean_ids)
        return await self._hydrate_conversation(updated or conv, current_user_id)

    async def remove_member(
        self,
        current_user_id: str,
        conversation_id: str,
        target_user_id: str,
    ) -> ConversationResponse:
        """Removes a participant from a group (Admin only)."""
        conv = await self.repo.find_by_id(conversation_id)
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

        if conv.get("type") != "group":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Participants cannot be removed from direct chat.")

        admins = [str(a) for a in conv.get("admins", [])]
        if current_user_id not in admins and str(conv.get("created_by")) != current_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only group admins can remove members.")

        updated = await self.repo.remove_member(conversation_id, target_user_id)
        return await self._hydrate_conversation(updated or conv, current_user_id)

    async def _dispatch_realtime_event(
        self,
        event_name: str,
        event_data: dict,
        conversation_id: str,
        members: List[str],
        sender_id: str,
    ) -> None:
        """Dispatches real-time event via Redis Pub/Sub and direct WebSocket REST bridge."""
        try:
            from shared.redis.client import redis_manager
            await redis_manager.publish(
                "fluxchat:events",
                {
                    "event": event_name,
                    "data": event_data,
                    "conversation_id": str(conversation_id),
                    "members": members,
                    "sender_id": str(sender_id),
                },
            )
        except Exception as e:
            logger.warning(f"Failed to publish {event_name} to Redis: {e}")

        try:
            ws_url = "http://127.0.0.1:8005"
            async with httpx.AsyncClient(timeout=2.0) as client:
                await client.post(
                    f"{ws_url}/api/v1/events/broadcast",
                    json={
                        "event": event_name,
                        "data": event_data,
                        "recipient_ids": members,
                    },
                )
        except Exception:
            pass

    async def delete_conversation(
        self, current_user_id: str, conversation_id: str
    ) -> ActionSuccessResponse:
        """Permanently deletes a conversation and wipes all previous stored data from MongoDB."""
        conv = None
        if conversation_id.startswith("c_"):
            recipient_id = conversation_id[2:]
            conv = await self.repo.find_direct_conversation(current_user_id, recipient_id)

        if not conv:
            conv = await self.repo.find_by_id(conversation_id)

        if not conv:
            # Purge any orphaned messages matching this ID for complete safety
            await self.repo.purge_all_conversation_messages(conversation_id, [current_user_id])
            return ActionSuccessResponse(
                status="ok",
                message="Conversation and all messages have been permanently deleted.",
            )

        canonical_id = conv["id"]
        members = [str(m) for m in conv.get("members", [])]
        if current_user_id not in members and str(conv.get("created_by")) != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this conversation.",
            )

        # 1. Permanently delete all messages in this conversation from MongoDB Atlas
        await self.repo.purge_all_conversation_messages(canonical_id, members)

        is_direct = conv.get("type") == "direct" or len(members) == 2

        if is_direct:
            now = datetime.now(timezone.utc)
            oid = _to_object_id(canonical_id)
            await self.repo.conversations.update_one(
                {"$or": [{"_id": oid}, {"_id": canonical_id}]},
                {
                    "$set": {
                        "last_message": None,
                        "updated_at": now,
                    },
                    "$addToSet": {"cleared_by": current_user_id},
                },
            )
            # Dispatch messages.cleared so active chat pages clear message history immediately
            await self._dispatch_realtime_event(
                "messages.cleared",
                {"conversation_id": canonical_id},
                canonical_id,
                members,
                current_user_id,
            )
            # Notify only the deleting user that the conversation was removed from their inbox
            await self._dispatch_realtime_event(
                "conversation.deleted",
                {"conversation_id": canonical_id},
                canonical_id,
                [current_user_id],
                current_user_id,
            )
        else:
            # 2. For group conversations, permanently delete the conversation document
            await self.repo.delete_conversation(canonical_id)
            await self._dispatch_realtime_event(
                "conversation.deleted",
                {"conversation_id": canonical_id},
                canonical_id,
                members,
                current_user_id,
            )

        return ActionSuccessResponse(
            status="ok",
            message="Conversation and all messages have been permanently deleted.",
        )

    async def leave_conversation(
        self, current_user_id: str, conversation_id: str
    ) -> ActionSuccessResponse:
        """Allows a user to leave or delete a conversation."""
        conv = await self.repo.find_by_id(conversation_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        if conv.get("type") == "direct":
            return await self.delete_conversation(current_user_id, conversation_id)

        members = [str(m) for m in conv.get("members", [])]
        if current_user_id not in members:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are not a participant in this conversation.",
            )

        await self.repo.remove_member(conversation_id, current_user_id)
        return ActionSuccessResponse(status="ok", message="Successfully left the conversation.")


conversation_service = ConversationService()
