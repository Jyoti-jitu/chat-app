"""
User repository for MongoDB database queries on the 'users' collection.
Encapsulates all database operations, filters, and projections.
"""
from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional
from bson import ObjectId
from shared.database.mongodb import db_manager


class UserRepository:
    """Handles CRUD queries for user documents in MongoDB Atlas."""

    @property
    def collection(self):
        """Returns the async Motor collection for users."""
        db = db_manager.get_database()
        return db.users

    @staticmethod
    def to_clean_dict(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Converts ObjectId to string 'id' and removes sensitive fields."""
        if not doc:
            return None
        clean = dict(doc)
        clean["id"] = str(clean.pop("_id"))
        clean.pop("password_hash", None)
        return clean

    async def get_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Finds user by ObjectId string."""
        try:
            doc = await self.collection.find_one({"_id": ObjectId(user_id)})
        except Exception:
            doc = await self.collection.find_one({"id": str(user_id)})
        return self.to_clean_dict(doc)

    async def get_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """Finds user by case-insensitive username."""
        doc = await self.collection.find_one({"username": username.strip().lower()})
        return self.to_clean_dict(doc)

    async def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Finds user by case-insensitive email."""
        doc = await self.collection.find_one({"email": email.strip().lower()})
        return self.to_clean_dict(doc)

    async def get_by_phone(self, phone: str) -> Optional[Dict[str, Any]]:
        """Finds user by normalized phone."""
        clean = phone.strip()
        doc = await self.collection.find_one({"phone": clean})
        return self.to_clean_dict(doc)

    async def update_profile(
        self, user_id: str, updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Updates user profile attributes and sets updated_at timestamp.
        Returns the updated user document.
        """
        if not updates:
            return await self.get_by_id(user_id)

        updates["updated_at"] = datetime.now(timezone.utc)

        try:
            filter_query = {"$or": [{"_id": ObjectId(user_id)}, {"_id": str(user_id)}]}
        except Exception:
            filter_query = {"_id": str(user_id)}

        result = await self.collection.find_one_and_update(
            filter_query,
            {"$set": updates},
            return_document=True,
        )
        return self.to_clean_dict(result)

    async def search_users(
        self,
        query: str,
        limit: int = 20,
        skip: int = 0,
        exclude_user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Searches users across username, name, email, or phone.
        If query is empty, returns all active registered users.
        Excludes inactive accounts and the current calling user.
        """
        clean_query = (query or "").strip()

        search_filter: Dict[str, Any] = {
            "is_active": True,
        }

        if clean_query:
            escaped_query = re.escape(clean_query)
            regex_filter = {"$regex": escaped_query, "$options": "i"}
            or_conditions: List[Dict[str, Any]] = [
                {"username": regex_filter},
                {"name": regex_filter},
                {"email": regex_filter},
                {"phone": regex_filter},
            ]
            digits_only = re.sub(r"\D", "", clean_query)
            if digits_only and len(digits_only) >= 3:
                or_conditions.append({"phone": {"$regex": re.escape(digits_only), "$options": "i"}})
            search_filter["$or"] = or_conditions

        if exclude_user_id:
            try:
                search_filter["_id"] = {"$ne": ObjectId(exclude_user_id)}
            except Exception:
                search_filter["id"] = {"$ne": str(exclude_user_id)}

        cursor = (
            self.collection.find(search_filter)
            .sort("name", 1)
            .skip(skip)
            .limit(limit)
        )

        users = []
        async for doc in cursor:
            clean = self.to_clean_dict(doc)
            if clean:
                users.append(clean)

        return users

    async def count_search_users(
        self, query: str, exclude_user_id: Optional[str] = None
    ) -> int:
        """Counts total users matching search query for pagination."""
        clean_query = (query or "").strip()

        search_filter: Dict[str, Any] = {
            "is_active": True,
        }

        if clean_query:
            escaped_query = re.escape(clean_query)
            regex_filter = {"$regex": escaped_query, "$options": "i"}
            or_conditions: List[Dict[str, Any]] = [
                {"username": regex_filter},
                {"name": regex_filter},
                {"email": regex_filter},
                {"phone": regex_filter},
            ]
            digits_only = re.sub(r"\D", "", clean_query)
            if digits_only and len(digits_only) >= 3:
                or_conditions.append({"phone": {"$regex": re.escape(digits_only), "$options": "i"}})
            search_filter["$or"] = or_conditions

        if exclude_user_id:
            try:
                search_filter["_id"] = {"$ne": ObjectId(exclude_user_id)}
            except Exception:
                search_filter["id"] = {"$ne": str(exclude_user_id)}

        return await self.collection.count_documents(search_filter)


user_repository = UserRepository()
