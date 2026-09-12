"""
FluxChat WebSocket Service application entry point.
Configures FastAPI, lifespan management, MongoDB connectivity, CORS, and WebSocket routing.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.health import router as root_health_router
from app.api.v1.router import api_v1_router
from app.api.v1.websockets import router as root_websockets_router
from app.core.config import settings
from app.core.logging import logger
import asyncio
import json
from app.core.connection_manager import connection_manager
from shared.database.mongodb import db_manager
from shared.redis.client import redis_manager
from shared.errors.handlers import register_exception_handlers



async def redis_event_listener():
    """Listens to Redis channels and forwards real-time events to connected clients."""
    ps = redis_manager.pubsub()
    await ps.subscribe("system:broadcast", "fluxchat:events")
    logger.info("Subscribed to Redis Pub/Sub channels ['system:broadcast', 'fluxchat:events'].")
    try:
        async for message in ps.listen():
            try:
                raw_data = message.get("data")
                if not raw_data:
                    continue
                payload = json.loads(raw_data) if isinstance(raw_data, str) else raw_data
                recipients = payload.get("recipients") or payload.get("members")
                exclude_user = payload.get("exclude_user_id") or payload.get("sender_id")

                if recipients and isinstance(recipients, list):
                    await connection_manager.broadcast_to_users(
                        payload, recipients, exclude_user_id=exclude_user
                    )
                else:
                    await connection_manager.broadcast_to_all(
                        payload, exclude_user_id=exclude_user
                    )
            except Exception as e:
                logger.warning(f"Error handling incoming Redis event frame: {e}")
    except asyncio.CancelledError:
        pass
    finally:
        await ps.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Initializes MongoDB and Redis connections on startup,
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
    listener_task = asyncio.create_task(redis_event_listener())

    yield

    logger.info(f"Shutting down {settings.APP_NAME}...")
    listener_task.cancel()
    try:
        await listener_task
    except asyncio.CancelledError:
        pass
    await redis_manager.disconnect()
    await db_manager.disconnect()
    logger.info("MongoDB and Redis connections closed gracefully.")


app = FastAPI(
    title=settings.APP_NAME,
    description="Microservice managing real-time WebSocket connections, presence, typing indicators, and message broadcasts for FluxChat.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
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
app.include_router(root_websockets_router)
app.include_router(api_v1_router)


@app.get("/", include_in_schema=False)
async def root():
    """Root redirect to OpenAPI documentation."""
    return {
        "service": settings.APP_NAME,
        "version": "1.0.0",
        "status": "online",
        "websocket_url": f"ws://localhost:{settings.PORT}/ws",
        "docs": "/docs",
    }
