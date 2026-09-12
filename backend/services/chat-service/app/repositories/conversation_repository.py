"""
Conversation Repository for MongoDB Atlas operations on `conversations` collection.
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


class ConversationRepository:
    """Data access layer for conversations and participants."""

    @property
    def conversations(self):
        """Returns the conversations collection."""
        db = db_manager.get_database()
        return db["conversations"]

    @property
    def users(self):
        """Returns the users collection for hydrating member profiles."""
        db = db_manager.get_database()
        return db["users"]

    async def find_by_id(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        """Finds a conversation by its string or ObjectId representation."""
        oid = _to_object_id(conversation_id)
        doc = await self.conversations.find_one({
            "$or": [{"_id": oid}, {"_id": conversation_id}]
        })
        return _normalize_id(doc)

    async def find_direct_conversation(
        self, user_a: str, user_b: str
    ) -> Optional[Dict[str, Any]]:
        """Finds an existing 1:1 direct conversation between two users."""
        doc = await self.conversations.find_one({
            "type": "direct",
            "members": {"$all": [user_a, user_b], "$size": 2},
        })
        return _normalize_id(doc)

    async def create_conversation(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Inserts a new conversation record."""
        now = datetime.now(timezone.utc)
        if "created_at" not in data:
            data["created_at"] = now
        if "updated_at" not in data:
            data["updated_at"] = now

        result = await self.conversations.insert_one(data)
        data["id"] = str(result.inserted_id)
        return data

    async def find_user_conversations(
        self, user_id: str, limit: int = 50, skip: int = 0
    ) -> List[Dict[str, Any]]:
        """Lists all conversations the user is a member of, sorted by recency."""
        cursor = (
            self.conversations.find({"members": user_id})
            .sort("updated_at", -1)
            .skip(skip)
            .limit(limit)
        )
        items = []
        async for doc in cursor:
            items.append(_normalize_id(doc))
        return items

    async def count_user_conversations(self, user_id: str) -> int:
        """Returns the total number of conversations for the user."""
        return await self.conversations.count_documents({"members": user_id})

    async def update_group_info(
        self, conversation_id: str, updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Updates group name, avatar, or metadata."""
        oid = _to_object_id(conversation_id)
        updates["updated_at"] = datetime.now(timezone.utc)
        await self.conversations.update_one(
            {"$or": [{"_id": oid}, {"_id": conversation_id}]},
            {"$set": updates},
        )
        return await self.find_by_id(conversation_id)

    async def add_members(
        self, conversation_id: str, member_ids: List[str]
    ) -> Optional[Dict[str, Any]]:
        """Adds members to a conversation uniquely using $addToSet."""
        oid = _to_object_id(conversation_id)
        now = datetime.now(timezone.utc)
        await self.conversations.update_one(
            {"$or": [{"_id": oid}, {"_id": conversation_id}]},
            {
                "$addToSet": {"members": {"$each": member_ids}},
                "$set": {"updated_at": now},
            },
        )
        return await self.find_by_id(conversation_id)

    async def remove_member(
        self, conversation_id: str, user_id: str
    ) -> Optional[Dict[str, Any]]:
        """Removes a user from members and admins."""
        oid = _to_object_id(conversation_id)
        now = datetime.now(timezone.utc)
        await self.conversations.update_one(
            {"$or": [{"_id": oid}, {"_id": conversation_id}]},
            {
                "$pull": {"members": user_id, "admins": user_id},
                "$set": {"updated_at": now},
            },
        )
        return await self.find_by_id(conversation_id)

    async def delete_conversation(self, conversation_id: str) -> bool:
        """Deletes a conversation document."""
        oid = _to_object_id(conversation_id)
        res = await self.conversations.delete_one({
            "$or": [{"_id": oid}, {"_id": conversation_id}]
        })
        return res.deleted_count > 0

    async def get_users_profiles(
        self, user_ids: List[str]
    ) -> Dict[str, Dict[str, Any]]:
        """
        Batch fetches user public profiles for a list of user IDs.
        Returns a mapping of user_id_str -> user profile dict.
        """
        if not user_ids:
            return {}

        oids = [_to_object_id(uid) for uid in user_ids]
        cursor = self.users.find({
            "$or": [{"_id": {"$in": oids}}, {"_id": {"$in": user_ids}}]
        })
        profiles: Dict[str, Dict[str, Any]] = {}
        async for doc in cursor:
            doc_id = str(doc["_id"])
            profiles[doc_id] = {
                "id": doc_id,
                "name": doc.get("name", "FluxChat User"),
                "username": doc.get("username", "user"),
                "avatar": doc.get("avatar"),
                "is_online": doc.get("is_online", False),
                "last_seen": doc.get("last_seen"),
            }
        return profiles


conversation_repository = ConversationRepository()
