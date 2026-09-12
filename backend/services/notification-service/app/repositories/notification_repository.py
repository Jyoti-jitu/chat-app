"""
Data Access Object for FluxChat notifications collection in MongoDB Atlas.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId
from shared.database.mongodb import db_manager


class NotificationRepository:
    """Encapsulates all database queries on notifications and user profiles."""

    @property
    def collection(self):
        return db_manager.get_database().notifications

    @property
    def users_collection(self):
        return db_manager.get_database().users

    async def create_notification(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Persists a new notification document."""
        doc = dict(data)
        doc["is_read"] = False
        doc["created_at"] = doc.get("created_at") or datetime.now(timezone.utc).isoformat()

        res = await self.collection.insert_one(doc)
        doc["id"] = str(res.inserted_id)
        return doc

    async def get_user_notifications(
        self,
        user_id: str,
        category: Optional[str] = None,
        limit: int = 50,
        skip: int = 0,
    ) -> List[Dict[str, Any]]:
        """Retrieves user notifications sorted in reverse chronological order."""
        query: Dict[str, Any] = {"user_id": str(user_id)}
        if category and category.lower() != "all":
            query["category"] = category.lower()

        cursor = (
            self.collection.find(query)
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )
        items = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            items.append(doc)
        return items

    async def count_user_notifications(
        self, user_id: str, category: Optional[str] = None
    ) -> int:
        """Returns total notification count for user under category."""
        query: Dict[str, Any] = {"user_id": str(user_id)}
        if category and category.lower() != "all":
            query["category"] = category.lower()
        return await self.collection.count_documents(query)

    async def count_unread(self, user_id: str) -> int:
        """Returns unread notification badge count."""
        return await self.collection.count_documents(
            {"user_id": str(user_id), "is_read": False}
        )

    async def mark_as_read(self, user_id: str, notification_id: str) -> bool:
        """Marks an individual notification as read."""
        if not ObjectId.is_valid(notification_id):
            return False
        res = await self.collection.update_one(
            {"_id": ObjectId(notification_id), "user_id": str(user_id)},
            {"$set": {"is_read": True}},
        )
        return res.modified_count > 0

    async def mark_all_as_read(self, user_id: str) -> int:
        """Marks all unread notifications as read."""
        res = await self.collection.update_many(
            {"user_id": str(user_id), "is_read": False},
            {"$set": {"is_read": True}},
        )
        return res.modified_count

    async def delete_notification(self, user_id: str, notification_id: str) -> bool:
        """Dismisses an individual notification."""
        if not ObjectId.is_valid(notification_id):
            return False
        res = await self.collection.delete_one(
            {"_id": ObjectId(notification_id), "user_id": str(user_id)}
        )
        return res.deleted_count > 0

    async def clear_all_notifications(self, user_id: str) -> int:
        """Deletes all notifications for the given user."""
        res = await self.collection.delete_many({"user_id": str(user_id)})
        return res.deleted_count

    async def get_actor_profile(self, actor_id: Optional[str]) -> Optional[Dict[str, Any]]:
        """Hydrates public profile snapshot of notification initiator."""
        if not actor_id or not ObjectId.is_valid(actor_id):
            return None
        user = await self.users_collection.find_one({"_id": ObjectId(actor_id)})
        if not user:
            return None
        return {
            "name": user.get("name", "FluxChat User"),
            "username": user.get("username"),
            "avatar": user.get("avatar"),
        }


notification_repository = NotificationRepository()
