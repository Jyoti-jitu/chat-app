from __future__ import annotations
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
    LastMessageInfo,
    UpdateGroupConversation,
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
        display names and avatars dynamically for direct 1:1 chats.
        """
        member_ids = conv.get("members", [])
        profiles_map = await self.repo.get_users_profiles(member_ids)

        members_list: List[ConversationMemberInfo] = []
        for mid in member_ids:
            p = profiles_map.get(str(mid))
            if p:
                members_list.append(
                    ConversationMemberInfo(
                        id=p["id"],
                        name=p["name"],
                        username=p["username"],
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
                content=last_msg_doc.get("content"),
                timestamp=last_msg_doc.get("timestamp"),
            )

        return ConversationResponse(
            id=conv["id"],
            type=conv_type,
            name=name,
            avatar=avatar,
            member_ids=[str(m) for m in member_ids],
            members=members_list,
            admins=[str(a) for a in conv.get("admins", [])],
            created_by=str(conv.get("created_by", "")),
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
        if len(unique_members) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A group conversation requires at least one other participant.",
            )

        conv_data = {
            "type": "group",
            "name": payload.name.strip(),
            "avatar": payload.avatar,
            "members": unique_members,
            "admins": [current_user_id],
            "created_by": current_user_id,
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
        conv = await self.repo.find_by_id(conversation_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        members = [str(m) for m in conv.get("members", [])]
        if current_user_id not in members:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this conversation.",
            )

        return await self._hydrate_conversation(conv, current_user_id)

    async def update_group_conversation(
        self,
        current_user_id: str,
        conversation_id: str,
        payload: UpdateGroupConversation,
    ) -> ConversationResponse:
        """Updates group name or avatar. Enforces that caller is an admin."""
        conv = await self.repo.find_by_id(conversation_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        if conv.get("type") != "group":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only group conversations can be updated.",
            )

        admins = [str(a) for a in conv.get("admins", [])]
        if current_user_id not in admins:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only conversation admins can modify group settings.",
            )

        updates: Dict[str, Any] = {}
        if payload.name is not None:
            updates["name"] = payload.name.strip()
        if payload.avatar is not None:
            updates["avatar"] = payload.avatar

        if updates:
            updated = await self.repo.update_group_info(conversation_id, updates)
            if updated:
                conv = updated

        return await self._hydrate_conversation(conv, current_user_id)

    async def add_members(
        self,
        current_user_id: str,
        conversation_id: str,
        payload: AddMembersPayload,
    ) -> ConversationResponse:
        """Adds members to a group conversation."""
        conv = await self.repo.find_by_id(conversation_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        if conv.get("type") != "group":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Members cannot be added to a direct 1:1 conversation.",
            )

        members = [str(m) for m in conv.get("members", [])]
        if current_user_id not in members:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must be a member of this conversation to add participants.",
            )

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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        if conv.get("type") != "group":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Participants cannot be removed from direct conversations.",
            )

        admins = [str(a) for a in conv.get("admins", [])]
        if current_user_id not in admins:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only conversation admins can remove members.",
            )

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
        """Permanently deletes a conversation and all its messages."""
        conv = await self.repo.find_by_id(conversation_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        members = [str(m) for m in conv.get("members", [])]
        if current_user_id not in members:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this conversation.",
            )

        # 1. Permanently delete all messages in this conversation from MongoDB
        db = db_manager.get_database()
        oid = _to_object_id(conversation_id)
        await db["messages"].delete_many({
            "$or": [
                {"conversation_id": conversation_id},
                {"conversation_id": oid},
            ]
        })

        # 2. Permanently delete the conversation document from MongoDB
        await self.repo.delete_conversation(conversation_id)

        # 3. Dispatch real-time event to notify participants
        await self._dispatch_realtime_event(
            "conversation.deleted",
            {"conversation_id": conversation_id},
            conversation_id,
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

        # In a 1:1 direct chat, leaving deletes the conversation and wipes all messages!
        if conv.get("type") == "direct":
            return await self.delete_conversation(current_user_id, conversation_id)

        members = [str(m) for m in conv.get("members", [])]
        if current_user_id not in members:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are not a participant in this conversation.",
            )

        await self.repo.remove_member(conversation_id, current_user_id)
        return ActionSuccessResponse(
            status="ok", message="You have left the conversation."
        )


conversation_service = ConversationService()
