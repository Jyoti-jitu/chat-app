"""
Status Repository for managing `statuses` collection in MongoDB Atlas.
Supports 24-hour expiration TTL and contact-scoped queries.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId
from shared.database.mongodb import db_manager


def _to_object_id(val: str) -> Any:
    try:
        return ObjectId(val)
    except Exception:
        return val


class StatusRepository:
    """Encapsulates database operations on the `statuses` collection."""

    @property
    def collection(self):
        """Returns the async Motor collection for statuses."""
        db = db_manager.get_database()
        return db.statuses

    @staticmethod
    def to_clean_dict(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not doc:
            return None
        clean = dict(doc)
        clean["id"] = str(clean.pop("_id"))
        return clean

    async def create_slide(self, doc_data: Dict[str, Any]) -> Dict[str, Any]:
        """Inserts a new status slide document."""
        res = await self.collection.insert_one(doc_data)
        doc_data["_id"] = res.inserted_id
        return self.to_clean_dict(doc_data)

    async def find_active_statuses_by_users(
        self, user_ids: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Retrieves all non-expired slides belonging to the specified user IDs.
        Sorted by created_at descending.
        """
        now = datetime.now(timezone.utc)
        query = {
            "user_id": {"$in": user_ids},
            "expires_at": {"$gt": now},
        }
        cursor = self.collection.find(query).sort("created_at", -1)
        items = []
        async for doc in cursor:
            items.append(self.to_clean_dict(doc))
        return items

    async def find_slide_by_id(self, slide_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a single slide by string or ObjectId."""
        oid = _to_object_id(slide_id)
        doc = await self.collection.find_one({"$or": [{"_id": oid}, {"_id": slide_id}]})
        return self.to_clean_dict(doc)

    async def delete_slide(self, slide_id: str, user_id: str) -> bool:
        """Deletes a slide only if owned by user_id."""
        oid = _to_object_id(slide_id)
        res = await self.collection.delete_one({
            "$and": [
                {"$or": [{"_id": oid}, {"_id": slide_id}]},
                {"user_id": user_id},
            ]
        })
        return res.deleted_count > 0

    async def delete_all_user_slides(self, user_id: str) -> int:
        """Deletes all status slides belonging to a user."""
        res = await self.collection.delete_many({"user_id": user_id})
        return res.deleted_count


status_repository = StatusRepository()
