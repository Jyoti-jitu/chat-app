"""
Database index management infrastructure.
Ensures compound and unique indexes are systematically maintained.
"""
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger("FluxChat.Database.Indexes")


class IndexManager:
    """Manages index creation across MongoDB collections."""

    @staticmethod
    async def create_indexes(db: AsyncIOMotorDatabase) -> None:
        """
        Create indexes as collections are introduced:
        - users: email (unique), username (unique)
        - revoked_tokens: token (unique), expires_at (TTL)
        - messages: conversation_id + created_at
        - conversations: members
        - notifications: user_id + created_at
        """
        try:
            # Users Collection Indexes
            await db.users.create_index("email", unique=True)
            await db.users.create_index("username", unique=True)
            
            # Token revocation index with automatic TTL cleanup
            await db.revoked_tokens.create_index("token", unique=True)
            await db.revoked_tokens.create_index("expires_at", expireAfterSeconds=0)
            
            logger.info("Database unique indexes for users and revoked_tokens verified.")
        except Exception as e:
            logger.warning(f"Index creation encountered a warning/notice: {e}")
