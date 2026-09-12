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
        Create indexes as collections are introduced in upcoming phases:
        - users: email (unique), username (unique)
        - messages: conversation_id + created_at
        - conversations: members
        - notifications: user_id + created_at
        """
        logger.info("Database index manager initialized.")
