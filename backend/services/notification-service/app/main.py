"""
FluxChat Notification Service application entry point.
Configures FastAPI, lifespan management, MongoDB connectivity, CORS, and notification routing.
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


app = FastAPI(
    title=settings.APP_NAME,
    description="Microservice managing persistent user notifications, alerts, and unread badges for FluxChat.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

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


@app.get("/", include_in_schema=False)
async def root():
    """Root redirect to OpenAPI documentation."""
    return {
        "service": settings.APP_NAME,
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs",
    }
