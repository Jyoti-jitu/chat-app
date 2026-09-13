"""
FluxChat User Service application entry point.
Configures FastAPI, lifespan management, MongoDB connectivity, CORS, and API routing.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.health import router as root_health_router
from app.api.v1.router import v1_router
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


USER_DESCRIPTION = """
# 👤 FluxChat User & Contacts Service

The **User Service** manages user profiles, public identity lookup, directory search, and bilateral contact requests.

## Capabilities
- **Profile Management**: Bio, display name, avatar, telephone number, and privacy preferences.
- **Directory Search**: Fast indexed search across usernames, emails, and phone numbers.
- **Contacts Handshake**: Bilateral connection requests (`pending`, `accepted`, `rejected`, `cancelled`).
- **Roster Retrieval**: Bilateral friendship roster with reciprocal validation.
"""

USER_TAGS = [
    {"name": "Users", "description": "User profile retrieval, updates, and public search."},
    {"name": "Contacts", "description": "Connection requests, handshake acceptance/rejection, and roster."},
    {"name": "Health", "description": "User Service health check and Atlas database verification."},
]

app = FastAPI(
    title="FluxChat User & Contacts Service",
    version="1.0.0",
    description=USER_DESCRIPTION,
    openapi_tags=USER_TAGS,
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
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routes
app.include_router(root_health_router)
app.include_router(v1_router)


@app.get(
    "/",
    status_code=status.HTTP_200_OK,
    tags=["Root"],
    summary="User Service Descriptor",
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
