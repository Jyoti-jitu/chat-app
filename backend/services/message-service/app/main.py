"""
FluxChat Message Service application entry point.
Configures FastAPI, lifespan management, MongoDB connectivity, CORS, and API routing.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.health import router as root_health_router
from app.api.v1.router import api_v1_router
from app.core.config import settings
from app.core.logging import logger
from shared.database.mongodb import db_manager
from shared.redis.client import redis_manager
from shared.errors.handlers import register_exception_handlers



@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Initializes and validates MongoDB and Redis connections on startup,
    and safely closes them on application shutdown.
    """
    logger.info(
        f"Starting {settings.APP_NAME} in [{settings.APP_ENV}] mode on {settings.HOST}:{settings.PORT}..."
    )
    try:
        await db_manager.connect(
            mongodb_url=settings.MONGODB_URL,
            database_name=settings.MONGODB_DATABASE,
        )
        logger.info("MongoDB Atlas connection established successfully.")
    except Exception as exc:
        logger.critical(f"Failed to connect to MongoDB Atlas during startup: {exc}")
        raise exc

    await redis_manager.connect()

    yield

    logger.info(f"Shutting down {settings.APP_NAME}...")
    await redis_manager.disconnect()
    await db_manager.disconnect()
    logger.info("MongoDB and Redis connections closed gracefully.")


MESSAGE_DESCRIPTION = """
# 📨 FluxChat Message Service

The **Message Service** manages message persistence, cursor-based pagination, author-only editing, soft-deletion, pinned messages, and read receipts.

## Capabilities
- **Cursor Pagination**: Opaque Base64 tokens for deterministic bidirectional timeline scrolling.
- **Message Reactions**: Idempotent emoji reactions with participant list and counts.
- **Pinned Messages**: Pin/unpin up to 5 critical messages per conversation.
- **Read Receipts**: Transition tracking (`sent` ➔ `delivered` ➔ `read`) with real-time sync.
"""

MESSAGE_TAGS = [
    {"name": "Messages", "description": "Message sending, cursor pagination, edits, and soft-deletes."},
    {"name": "Reactions", "description": "Emoji reactions, add/remove toggles, and aggregates."},
    {"name": "Pins", "description": "Pinned message management per conversation."},
    {"name": "Health", "description": "Message Service health check and Atlas database verification."},
]

app = FastAPI(
    title="FluxChat Message Service",
    version="1.0.0",
    description=MESSAGE_DESCRIPTION,
    openapi_tags=MESSAGE_TAGS,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
    contact={
        "name": "FluxChat Engineering Team",
        "url": "https://github.com/Jyoti-jitu/chat-app",
    },
    license_info={
        "name": "MIT License",
    },
)

register_exception_handlers(app)

# CORS Configuration

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routes
app.include_router(root_health_router)
app.include_router(api_v1_router)


@app.get(
    "/",
    status_code=status.HTTP_200_OK,
    tags=["Root"],
    summary="Message Service Descriptor",
)
async def root():
    """Root metadata descriptor."""
    return {
        "service": settings.APP_NAME,
        "version": "1.0.0",
        "status": "running",
        "docs_url": "/docs",
        "health_url": "/health",
    }
