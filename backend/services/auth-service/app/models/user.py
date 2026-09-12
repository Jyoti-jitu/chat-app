"""
User domain model and serialization helpers.
Transforms internal MongoDB documents into clean API-safe dictionaries.
"""
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from bson import ObjectId


class UserModel:
    """User data formatting and mapping layer."""

    @staticmethod
    def create_document(
        name: str,
        username: str,
        email: str,
        password_hash: str,
        phone: Optional[str] = None,
        avatar: Optional[str] = None,
        bio: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Creates a new MongoDB user document dictionary."""
        now = datetime.now(timezone.utc)
        return {
            "name": name.strip(),
            "username": username.strip().lower(),
            "email": email.strip().lower(),
            "password_hash": password_hash,
            "phone": phone.strip() if phone else None,
            "avatar": avatar or f"https://api.dicebear.com/7.x/avataaars/svg?seed={username.strip().lower()}",
            "bio": bio or "Hey there! I am using FluxChat.",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
            "last_login": None,
        }

    @staticmethod
    def to_dict(doc: Optional[Dict[str, Any]], include_sensitive: bool = False) -> Optional[Dict[str, Any]]:
        """
        Converts a MongoDB document into a clean serialized dictionary.
        - Converts `_id` (ObjectId) to `id` (str)
        - Removes `password_hash` unless explicitly requested internally
        - Formats datetime fields
        """
        if not doc:
            return None

        data = dict(doc)
        if "_id" in data:
            data["id"] = str(data.pop("_id"))

        if not include_sensitive:
            data.pop("password_hash", None)

        return data
