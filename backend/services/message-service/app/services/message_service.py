"""
Message Service encapsulating business logic for message creation, thread retrieval,
author verification, soft deletion, and status transitions.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional
import httpx
from fastapi import HTTPException, status
from app.core.config import settings
from app.core.logging import logger
from app.repositories.message_repository import message_repository
from app.schemas.message import (
    EditMessagePayload,
    MessageAttachment,
    MessageListResponse,
    MessageResponse,
    SendMessagePayload,
)
from shared.redis.client import redis_manager


class MessageService:
    """Business logic for messaging subsystem."""

    def __init__(self):
        self.repo = message_repository

    async def _dispatch_realtime_event(
        self,
        event_name: str,
        event_data: dict,
        conversation_id: str,
        members: List[str],
        sender_id: str,
    ) -> None:
        """Dispatches real-time event via Redis Pub/Sub and direct WebSocket REST bridge."""
        # 1. Publish to Redis Pub/Sub
        try:
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

        # 2. Direct HTTP bridge to WebSocket service (ensures delivery even without Redis server)
        try:
            ws_url = getattr(settings, "WS_SERVICE_URL", "http://localhost:8005").rstrip("/")
            async with httpx.AsyncClient(timeout=2.0) as client:
                await client.post(
                    f"{ws_url}/api/v1/events/broadcast",
                    json={
                        "event": event_name,
                        "data": event_data,
                        "recipient_ids": members,
                        "exclude_user_id": str(sender_id),
                    },
                )
        except Exception as e:
            logger.debug(f"Direct WS broadcast bridge notice: {e}")

    def _to_response(self, doc: Dict[str, Any]) -> MessageResponse:
        """Converts raw MongoDB message document to Pydantic MessageResponse."""
        attachment_data = doc.get("attachment")
        attachment = None
        if attachment_data and isinstance(attachment_data, dict):
            attachment = MessageAttachment(
                name=attachment_data.get("name", "file"),
                size=attachment_data.get("size", "0 B"),
                url=attachment_data.get("url", ""),
                type=attachment_data.get("type", "file"),
            )

        return MessageResponse(
            id=str(doc.get("_id", doc.get("id"))),
            conversation_id=str(doc.get("conversation_id")),
            sender_id=str(doc.get("sender_id")),
            content=doc.get("content", ""),
            type=doc.get("type", "text"),
            attachment=attachment,
            reply_to=doc.get("reply_to"),
            status=doc.get("status", "sent"),
            edited=doc.get("edited", False),
            deleted=doc.get("deleted", False),
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
        )

    async def _verify_conversation_membership(
        self, user_id: str, conversation_id: str
    ) -> Dict[str, Any]:
        """Ensures the conversation exists and the caller is an active participant."""
        conv = await self.repo.get_conversation(conversation_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        members = [str(m) for m in conv.get("members", [])]
        if str(user_id) not in members:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this conversation.",
            )

        return conv

    async def send_message(
        self, current_user_id: str, conversation_id: str, payload: SendMessagePayload
    ) -> MessageResponse:
        """Validates membership, persists message in thread, and publishes real-time event."""
        conv = await self._verify_conversation_membership(current_user_id, conversation_id)
        members = [str(m) for m in conv.get("members", [])]

        msg_data = {
            "conversation_id": str(conversation_id),
            "sender_id": str(current_user_id),
            "content": payload.content.strip(),
            "type": payload.type,
            "attachment": payload.attachment.model_dump() if payload.attachment else None,
            "reply_to": payload.reply_to,
            "status": "sent",
            "edited": False,
            "deleted": False,
        }

        created = await self.repo.create_message(msg_data)

        # Synchronize conversation preview
        summary_content = (
            payload.content.strip()
            if payload.type == "text"
            else f"[{payload.type.capitalize()}] {payload.attachment.name if payload.attachment else ''}"
        )
        await self.repo.update_conversation_last_message(
            conversation_id,
            {
                "id": created["id"],
                "sender_id": str(current_user_id),
                "content": summary_content,
                "timestamp": created["created_at"],
            },
        )

        logger.info(
            f"Message [{created['id']}] sent in conversation [{conversation_id}] by {current_user_id}"
        )
        resp = self._to_response(created)

        # Publish event to Redis Pub/Sub & WebSocket Service REST bridge
        await self._dispatch_realtime_event(
            "message.new",
            resp.model_dump(mode="json"),
            str(conversation_id),
            members,
            str(current_user_id),
        )

        return resp

    async def get_messages(
        self,
        current_user_id: str,
        conversation_id: str,
        limit: int = 30,
        cursor: Optional[str] = None,
    ) -> MessageListResponse:
        """Retrieves messages for a conversation thread with cursor pagination."""
        from app.core.pagination import decode_cursor

        await self._verify_conversation_membership(current_user_id, conversation_id)

        cursor_time = None
        cursor_id = None
        if cursor:
            cursor_time, cursor_id = decode_cursor(cursor)

        items, next_cursor, has_more = await self.repo.get_messages_by_conversation(
            conversation_id,
            limit=limit,
            cursor_time=cursor_time,
            cursor_id=cursor_id,
        )
        total = await self.repo.count_messages(conversation_id)

        return MessageListResponse(
            items=[self._to_response(doc) for doc in items],
            total=total,
            next_cursor=next_cursor,
            has_more=has_more,
        )

    async def edit_message(
        self, current_user_id: str, message_id: str, payload: EditMessagePayload
    ) -> MessageResponse:
        """Edits an existing message (Author only) and broadcasts update."""
        msg = await self.repo.find_by_id(message_id)
        if not msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found.",
            )

        if msg.get("deleted"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot edit a deleted message.",
            )

        if str(msg.get("sender_id")) != str(current_user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only edit your own messages.",
            )

        updated = await self.repo.edit_message(message_id, payload.content.strip())
        logger.info(f"Message [{message_id}] edited by author {current_user_id}")
        resp = self._to_response(updated or msg)

        # Broadcast edit event
        conv = await self.repo.get_conversation(msg["conversation_id"])
        members = [str(m) for m in conv.get("members", [])] if conv else []
        await self._dispatch_realtime_event(
            "message.updated",
            resp.model_dump(mode="json"),
            str(msg["conversation_id"]),
            members,
            str(current_user_id),
        )

        return resp

    async def delete_message(
        self, current_user_id: str, message_id: str
    ) -> MessageResponse:
        """Soft deletes a message, preserving thread ordering (Author only) and broadcasts deletion."""
        msg = await self.repo.find_by_id(message_id)
        if not msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found.",
            )

        if str(msg.get("sender_id")) != str(current_user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own messages.",
            )

        deleted = await self.repo.soft_delete_message(message_id)
        logger.info(f"Message [{message_id}] soft deleted by author {current_user_id}")
        resp = self._to_response(deleted or msg)

        # Broadcast deletion event
        conv = await self.repo.get_conversation(msg["conversation_id"])
        members = [str(m) for m in conv.get("members", [])] if conv else []
        await self._dispatch_realtime_event(
            "message.deleted",
            resp.model_dump(mode="json"),
            str(msg["conversation_id"]),
            members,
            str(current_user_id),
        )

        return resp

    async def mark_message_as_read(
        self, current_user_id: str, message_id: str
    ) -> MessageResponse:
        """Marks message status as 'read' and broadcasts receipt."""
        msg = await self.repo.find_by_id(message_id)
        if not msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found.",
            )

        # Verify membership in conversation
        conv = await self._verify_conversation_membership(
            current_user_id, msg["conversation_id"]
        )
        members = [str(m) for m in conv.get("members", [])]

        updated = await self.repo.mark_as_read(message_id)
        resp = self._to_response(updated or msg)

        # Broadcast read receipt event
        await self._dispatch_realtime_event(
            "message.read",
            {
                "message_id": message_id,
                "conversation_id": str(msg["conversation_id"]),
                "reader_id": str(current_user_id),
            },
            str(msg["conversation_id"]),
            members,
            str(current_user_id),
        )

        return resp


message_service = MessageService()
