"""
Message Repository for MongoDB Atlas operations on `messages` and `conversations` collections.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from bson import ObjectId
from shared.database.mongodb import db_manager


def _normalize_id(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Converts MongoDB _id to string id field."""
    if not doc:
        return None
    doc["id"] = str(doc["_id"])
    return doc


def _to_object_id(val: str) -> Any:
    """Safely converts string to ObjectId or returns raw string."""
    try:
        return ObjectId(val)
    except Exception:
        return val


class MessageRepository:
    """Data access layer for chat messages and thread persistence."""

    @property
    def collection(self):
        """Returns the messages collection."""
        db = db_manager.get_database()
        return db["messages"]

    @property
    def conversations(self):
        """Returns the conversations collection for membership verification."""
        db = db_manager.get_database()
        return db["conversations"]

    async def get_conversation(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        """Fetches a conversation by string or ObjectId."""
        oid = _to_object_id(conversation_id)
        doc = await self.conversations.find_one({
            "$or": [{"_id": oid}, {"_id": conversation_id}]
        })
        return _normalize_id(doc)

    async def create_message(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Inserts a new message document."""
        now = datetime.now(timezone.utc)
        if "created_at" not in data:
            data["created_at"] = now
        if "updated_at" not in data:
            data["updated_at"] = now

        result = await self.collection.insert_one(data)
        data["id"] = str(result.inserted_id)
        return data

    async def find_by_id(self, message_id: str) -> Optional[Dict[str, Any]]:
        """Finds a single message by ID."""
        oid = _to_object_id(message_id)
        doc = await self.collection.find_one({
            "$or": [{"_id": oid}, {"_id": message_id}]
        })
        return _normalize_id(doc)

    async def get_messages_by_conversation(
        self,
        conversation_id: str,
        limit: int = 30,
        cursor_time: Optional[datetime] = None,
        cursor_id: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], Optional[str], bool]:
        """
        Retrieves messages for a conversation using cursor pagination.
        Fetches backward in time (newest to oldest), then reverses to chronological order for UI display.
        Returns: (items, next_cursor, has_more)
        """
        from app.core.pagination import encode_cursor

        query: Dict[str, Any] = {"conversation_id": str(conversation_id)}
        if cursor_time and cursor_id:
            oid = _to_object_id(cursor_id)
            query["$or"] = [
                {"created_at": {"$lt": cursor_time}},
                {"created_at": cursor_time, "_id": {"$lt": oid}},
            ]
        elif cursor_time:
            query["created_at"] = {"$lt": cursor_time}

        # Query limit + 1 to detect if further pages exist
        cursor = (
            self.collection.find(query)
            .sort([("created_at", -1), ("_id", -1)])
            .limit(limit + 1)
        )

        raw_items = []
        async for doc in cursor:
            raw_items.append(_normalize_id(doc))

        has_more = len(raw_items) > limit
        if has_more:
            items = raw_items[:limit]
            last_item = items[-1]
            next_cursor = encode_cursor(last_item["created_at"], last_item["id"])
        else:
            items = raw_items
            next_cursor = None

        # Reverse to chronological order (oldest to newest) for UI thread display
        items.reverse()
        return items, next_cursor, has_more

    async def count_messages(self, conversation_id: str) -> int:
        """Counts total messages in a conversation."""
        return await self.collection.count_documents({"conversation_id": str(conversation_id)})

    async def edit_message(
        self, message_id: str, new_content: str
    ) -> Optional[Dict[str, Any]]:
        """Updates message content and sets edited flag."""
        oid = _to_object_id(message_id)
        now = datetime.now(timezone.utc)
        await self.collection.update_one(
            {"$or": [{"_id": oid}, {"_id": message_id}]},
            {
                "$set": {
                    "content": new_content,
                    "edited": True,
                    "updated_at": now,
                }
            },
        )
        return await self.find_by_id(message_id)

    async def soft_delete_message(self, message_id: str) -> Optional[Dict[str, Any]]:
        """Replaces message content with deletion placeholder and sets deleted flag."""
        oid = _to_object_id(message_id)
        now = datetime.now(timezone.utc)
        await self.collection.update_one(
            {"$or": [{"_id": oid}, {"_id": message_id}]},
            {
                "$set": {
                    "content": "This message was deleted",
                    "deleted": True,
                    "attachment": None,
                    "updated_at": now,
                }
            },
        )
        return await self.find_by_id(message_id)

    async def mark_as_read(self, message_id: str) -> Optional[Dict[str, Any]]:
        """Sets message status to 'read'."""
        oid = _to_object_id(message_id)
        now = datetime.now(timezone.utc)
        await self.collection.update_one(
            {"$or": [{"_id": oid}, {"_id": message_id}]},
            {
                "$set": {
                    "status": "read",
                    "updated_at": now,
                }
            },
        )
        return await self.find_by_id(message_id)

    async def update_conversation_last_message(
        self, conversation_id: str, last_message_doc: Dict[str, Any]
    ) -> None:
        """Updates the conversation record with summary of the most recent message."""
        oid = _to_object_id(conversation_id)
        now = datetime.now(timezone.utc)
        await self.conversations.update_one(
            {"$or": [{"_id": oid}, {"_id": conversation_id}]},
            {
                "$set": {
                    "last_message": last_message_doc,
                    "updated_at": now,
                }
            },
        )


message_repository = MessageRepository()
