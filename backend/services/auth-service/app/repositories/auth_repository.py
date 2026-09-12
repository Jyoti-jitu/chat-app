"""
Auth repository isolating all direct MongoDB operations for authentication.
Implements the Repository Pattern for the users and revoked_tokens collections.
"""
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from bson import ObjectId
from shared.database.mongodb import db_manager


class AuthRepository:
    """Isolates MongoDB database operations for the Authentication service."""

    @property
    def users_collection(self):
        """Returns the users collection from the active MongoDB database."""
        db = db_manager.get_database()
        return db.users

    @property
    def revoked_tokens_collection(self):
        """Returns the revoked_tokens collection from the active MongoDB database."""
        db = db_manager.get_database()
        return db.revoked_tokens

    async def create_user(self, user_doc: Dict[str, Any]) -> Dict[str, Any]:
        """Inserts a new user document into the users collection."""
        result = await self.users_collection.insert_one(user_doc)
        user_doc["_id"] = result.inserted_id
        return user_doc

    async def get_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a user by their string representation of ObjectId."""
        if not ObjectId.is_valid(user_id):
            return None
        return await self.users_collection.find_one({"_id": ObjectId(user_id)})

    async def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Retrieves a user document by lowercase email."""
        return await self.users_collection.find_one({"email": email.strip().lower()})

    async def get_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """Retrieves a user document by lowercase username."""
        return await self.users_collection.find_one({"username": username.strip().lower()})

    async def get_by_email_or_username(self, identifier: str) -> Optional[Dict[str, Any]]:
        """Retrieves a user document matching either email or username."""
        clean = identifier.strip().lower()
        return await self.users_collection.find_one({
            "$or": [
                {"email": clean},
                {"username": clean},
            ]
        })

    async def get_by_phone(self, phone: str) -> Optional[Dict[str, Any]]:
        """Retrieves a user document by normalized phone number."""
        clean = phone.strip()
        return await self.users_collection.find_one({"phone": clean})

    async def update_last_login(self, user_id: str) -> None:
        """Updates the last_login timestamp for a user."""
        if not ObjectId.is_valid(user_id):
            return
        await self.users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"last_login": datetime.now(timezone.utc)}},
        )

    async def revoke_token(self, token: str, expires_at: datetime) -> None:
        """Stores a revoked token so it cannot be used again."""
        try:
            await self.revoked_tokens_collection.update_one(
                {"token": token},
                {"$set": {"token": token, "expires_at": expires_at, "revoked_at": datetime.now(timezone.utc)}},
                upsert=True,
            )
        except Exception:
            pass

    async def is_token_revoked(self, token: str) -> bool:
        """Checks if a token has been explicitly revoked / blacklisted."""
        doc = await self.revoked_tokens_collection.find_one({"token": token})
        return doc is not None

    async def update_password(self, user_id: str, new_password_hash: str) -> bool:
        """Updates the password hash and updated_at timestamp for a user."""
        if not ObjectId.is_valid(user_id):
            return False
        result = await self.users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"password_hash": new_password_hash, "updated_at": datetime.now(timezone.utc)}},
        )
        return result.modified_count > 0


auth_repository = AuthRepository()
