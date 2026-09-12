"""
Message Repository for MongoDB Atlas operations on `messages` and `conversations` collections.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
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
        self, conversation_id: str, limit: int = 100, skip: int = 0
    ) -> List[Dict[str, Any]]:
        """Retrieves messages for a conversation sorted chronologically."""
        cursor = (
            self.collection.find({"conversation_id": str(conversation_id)})
            .sort("created_at", 1)
            .skip(skip)
            .limit(limit)
        )
        items = []
        async for doc in cursor:
            items.append(_normalize_id(doc))
        return items

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
