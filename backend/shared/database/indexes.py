"""
Database index management infrastructure (Phase 24 Compound Indexes Optimization).
Ensures compound and unique indexes are systematically maintained across MongoDB Atlas collections.
"""
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger("FluxChat.Database.Indexes")


class IndexManager:
    """Manages compound and unique index creation across MongoDB collections."""

    @staticmethod
    async def create_indexes(db: AsyncIOMotorDatabase) -> None:
        """
        Creates and ensures all optimized compound and unique indexes exist:
        - users: email (unique), username (unique), phone (sparse, unique)
        - revoked_tokens: token (unique), expires_at (TTL)
        - messages: conversation_id + created_at + _id (cursor pagination)
        - conversations: members + updated_at (feed timeline)
        - contact_requests: sender_id + recipient_id (unique), recipient_id + status
        - contacts: user_id + contact_id (unique bilateral roster)
        - notifications: user_id + created_at + is_read (inbox & unread count)
        """
        try:
            # 1. Users Collection Indexes
            await db.users.create_index("email", unique=True)
            await db.users.create_index("username", unique=True)
            await db.users.create_index(

                "phone",
                unique=True,
                partialFilterExpression={"phone": {"$type": "string"}},
            )


            # 2. Token Revocation Index (Automatic TTL expiration cleanup)
            await db.revoked_tokens.create_index("token", unique=True)
            await db.revoked_tokens.create_index("expires_at", expireAfterSeconds=0)

            # 3. Messages Collection Compound Index for Cursor Pagination
            await db.messages.create_index(
                [("conversation_id", 1), ("created_at", -1), ("_id", -1)]
            )

            # 4. Conversations Collection Compound Index for User Timeline Feed
            await db.conversations.create_index(
                [("members", 1), ("updated_at", -1)]
            )

            # 5. Contact Requests Indexes
            await db.contact_requests.create_index(
                [("sender_id", 1), ("recipient_id", 1)], unique=True
            )
            await db.contact_requests.create_index(
                [("recipient_id", 1), ("status", 1)]
            )

            # 6. Contacts Collection Index for Bilateral Roster
            await db.contacts.create_index(
                [("user_id", 1), ("contact_id", 1)], unique=True
            )

            # 7. Notifications Collection Compound Index for Inbox & Unread Badges
            await db.notifications.create_index(
                [("user_id", 1), ("created_at", -1), ("is_read", 1)]
            )

            logger.info("All Phase 24 MongoDB compound and unique indexes verified.")
        except Exception as e:
            logger.warning(f"Index creation encountered an advisory notice: {e}")
