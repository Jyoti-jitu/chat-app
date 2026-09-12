"""
Shared MongoDB connection manager using Motor (async driver for PyMongo).
Provides startup connection, graceful shutdown, validation, and database access.
"""
import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

logger = logging.getLogger("FluxChat.Database")


class MongoDBManager:
    """Manages connection lifecycle and access to MongoDB database."""

    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.db: Optional[AsyncIOMotorDatabase] = None
        self._url: Optional[str] = None
        self._db_name: Optional[str] = None

    async def connect(self, mongodb_url: str, database_name: str) -> None:
        """Establish connection to MongoDB and validate connection with a ping."""
        self._url = mongodb_url
        self._db_name = database_name
        logger.info(f"Connecting to MongoDB at {mongodb_url} [database: {database_name}]...")
        try:
            client_kwargs = {
                "serverSelectionTimeoutMS": 8000,
                "connectTimeoutMS": 8000,
            }

            # Enable certifi CA bundle for Atlas SRV / TLS connections
            if "mongodb+srv" in mongodb_url or "ssl=true" in mongodb_url.lower() or "tls=true" in mongodb_url.lower():
                try:
                    import certifi
                    client_kwargs["tlsCAFile"] = certifi.where()
                except ImportError:
                    pass

            self.client = AsyncIOMotorClient(
                mongodb_url,
                **client_kwargs
            )
            self.db = self.client[database_name]
            # Validate connection with admin ping command
            await self.client.admin.command("ping")
            logger.info("Successfully established and validated MongoDB connection.")

        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"Failed to connect to MongoDB at {mongodb_url}: {e}")
            raise e

    async def disconnect(self) -> None:
        """Close connection to MongoDB gracefully."""
        if self.client is not None:
            logger.info("Closing MongoDB client connection...")
            self.client.close()
            self.client = None
            self.db = None
            logger.info("MongoDB connection successfully closed.")

    async def is_connected(self) -> bool:
        """Check if connection to MongoDB is healthy and responsive."""
        if self.client is None or self.db is None:
            return False
        try:
            await self.client.admin.command("ping")
            return True
        except Exception:
            return False

    def get_database(self) -> AsyncIOMotorDatabase:
        """Return the current database instance for repository access."""
        if self.db is None:
            raise RuntimeError("Database is not connected. Call connect() first.")
        return self.db


# Global singleton instance for shared connection management
db_manager = MongoDBManager()


def get_db() -> AsyncIOMotorDatabase:
    """FastAPI dependency or helper to access the active database."""
    return db_manager.get_database()
