"""
Contact repository for managing contact_requests and contacts collections in MongoDB Atlas.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId
from shared.database.mongodb import db_manager


class ContactRepository:
    """Encapsulates all database operations for contact requests and contact rosters."""

    @property
    def requests_collection(self):
        """Returns the async Motor collection for contact_requests."""
        db = db_manager.get_database()
        return db.contact_requests

    @property
    def contacts_collection(self):
        """Returns the async Motor collection for contacts."""
        db = db_manager.get_database()
        return db.contacts

    @staticmethod
    def to_clean_dict(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Converts ObjectId to string 'id'."""
        if not doc:
            return None
        clean = dict(doc)
        clean["id"] = str(clean.pop("_id"))
        return clean

    # --------------------------------------------------------------------------
    # Contact Requests Operations
    # --------------------------------------------------------------------------

    async def get_request_by_id(self, request_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a contact request by its ObjectId."""
        try:
            doc = await self.requests_collection.find_one({"_id": ObjectId(request_id)})
        except Exception:
            doc = await self.requests_collection.find_one({"id": str(request_id)})
        return self.to_clean_dict(doc)

    async def find_existing_request(
        self, user_a: str, user_b: str
    ) -> Optional[Dict[str, Any]]:
        """Finds any active or pending request between two users in either direction."""
        doc = await self.requests_collection.find_one(
            {
                "status": "pending",
                "$or": [
                    {"sender_id": user_a, "recipient_id": user_b},
                    {"sender_id": user_b, "recipient_id": user_a},
                ],
            }
        )
        return self.to_clean_dict(doc)

    async def create_request(
        self, sender_id: str, recipient_id: str
    ) -> Dict[str, Any]:
        """Creates and stores a new pending connection request."""
        now = datetime.now(timezone.utc)
        doc = {
            "sender_id": sender_id,
            "recipient_id": recipient_id,
            "status": "pending",
            "created_at": now,
            "updated_at": now,
        }
        res = await self.requests_collection.insert_one(doc)
        doc["_id"] = res.inserted_id
        return self.to_clean_dict(doc)

    async def update_request_status(
        self, request_id: str, new_status: str
    ) -> Optional[Dict[str, Any]]:
        """Updates the status of a connection request (e.g. accepted, rejected, cancelled)."""
        now = datetime.now(timezone.utc)
        try:
            filter_query = {"_id": ObjectId(request_id)}
        except Exception:
            filter_query = {"id": str(request_id)}

        res = await self.requests_collection.find_one_and_update(
            filter_query,
            {"$set": {"status": new_status, "updated_at": now}},
            return_document=True,
        )
        return self.to_clean_dict(res)

    async def get_received_requests(
        self, user_id: str, status: Optional[str] = "pending"
    ) -> List[Dict[str, Any]]:
        """Retrieves requests sent to this user."""
        query: Dict[str, Any] = {"recipient_id": user_id}
        if status:
            query["status"] = status

        cursor = self.requests_collection.find(query).sort("created_at", -1)
        results = []
        async for doc in cursor:
            results.append(self.to_clean_dict(doc))
        return results

    async def get_sent_requests(
        self, user_id: str, status: Optional[str] = "pending"
    ) -> List[Dict[str, Any]]:
        """Retrieves requests initiated by this user."""
        query: Dict[str, Any] = {"sender_id": user_id}
        if status:
            query["status"] = status

        cursor = self.requests_collection.find(query).sort("created_at", -1)
        results = []
        async for doc in cursor:
            results.append(self.to_clean_dict(doc))
        return results

    # --------------------------------------------------------------------------
    # Established Contacts Operations
    # --------------------------------------------------------------------------

    async def is_contact(self, user_id: str, contact_id: str) -> bool:
        """Checks if two users are already connected in the contacts collection."""
        doc = await self.contacts_collection.find_one(
            {"user_id": user_id, "contact_id": contact_id}
        )
        return doc is not None

    async def add_contact_pair(self, user_a: str, user_b: str) -> None:
        """Inserts bidirectional contact records."""
        now = datetime.now(timezone.utc)
        # Check and insert for A -> B
        await self.contacts_collection.update_one(
            {"user_id": user_a, "contact_id": user_b},
            {"$setOnInsert": {"user_id": user_a, "contact_id": user_b, "created_at": now}},
            upsert=True,
        )
        # Check and insert for B -> A
        await self.contacts_collection.update_one(
            {"user_id": user_b, "contact_id": user_a},
            {"$setOnInsert": {"user_id": user_b, "contact_id": user_a, "created_at": now}},
            upsert=True,
        )

    async def remove_contact_pair(self, user_a: str, user_b: str) -> None:
        """Deletes bidirectional contact records."""
        await self.contacts_collection.delete_many(
            {
                "$or": [
                    {"user_id": user_a, "contact_id": user_b},
                    {"user_id": user_b, "contact_id": user_a},
                ]
            }
        )

    async def get_contacts_for_user(self, user_id: str) -> List[Dict[str, Any]]:
        """Retrieves all contact records for a user."""
        cursor = self.contacts_collection.find({"user_id": user_id}).sort("created_at", -1)
        results = []
        async for doc in cursor:
            results.append(self.to_clean_dict(doc))
        return results


contact_repository = ContactRepository()
