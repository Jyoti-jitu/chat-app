"""
FluxChat Chat & Conversation Service application entry point.
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
from shared.errors.handlers import register_exception_handlers



@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Initializes and validates MongoDB connection on startup,
    and safely closes it on application shutdown.
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

    yield

    logger.info(f"Shutting down {settings.APP_NAME}...")
    await db_manager.disconnect()
    logger.info("MongoDB connection closed gracefully.")


CHAT_DESCRIPTION = """
# 💬 FluxChat Conversation & Group Service

The **Chat Service** manages direct 1:1 messaging channels, multi-participant group chats, member rosters, and inbox feeds.

## Capabilities
- **Direct 1:1 Chats**: Deterministic recipient deduplication ensuring unique channels per pair.
- **Group Conversations**: Dynamic group naming, member additions, removals, and admin permissions.
- **Inbox Feed Sorting**: Chronological feed ordering via Atlas compound index `{ members: 1, updated_at: -1 }`.
"""

CHAT_TAGS = [
    {"name": "Conversations", "description": "1:1 direct conversations, group channels, and member management."},
    {"name": "Health", "description": "Chat Service health check and Atlas database verification."},
]

app = FastAPI(
    title="FluxChat Conversation & Group Service",
    version="1.0.0",
    description=CHAT_DESCRIPTION,
    openapi_tags=CHAT_TAGS,
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
    summary="Conversation Service Descriptor",
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
