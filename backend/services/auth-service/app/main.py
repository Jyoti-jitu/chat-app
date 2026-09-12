import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager

# Ensure backend root is on sys.path for shared package imports
backend_root = Path(__file__).resolve().parent.parent.parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import logger
from app.api.v1.router import api_router
from app.schemas.health import HealthResponse, RootResponse
from shared.database.mongodb import db_manager
from shared.database.indexes import IndexManager
from shared.errors.handlers import register_exception_handlers



@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        f"Starting {settings.APP_NAME} in [{settings.APP_ENV}] mode on {settings.HOST}:{settings.PORT}..."
    )
    # Phase 2: Establish and validate MongoDB connection on startup
    try:
        await db_manager.connect(settings.MONGODB_URL, settings.MONGODB_DATABASE)
        await IndexManager.create_indexes(db_manager.get_database())
        logger.info("MongoDB initialized successfully.")
    except Exception as e:
        logger.warning(
            f"MongoDB connection failed at startup ({e}). Service starting in degraded mode."
        )

    yield

    # Graceful shutdown
    await db_manager.disconnect()
    logger.info(f"Shutting down {settings.APP_NAME}...")


AUTH_DESCRIPTION = """
# 🔐 FluxChat Authentication & Identity Service

The **Auth Service** manages user credentials, registration, session lifecycles, JWT token rotation, and 2Factor SMS OTP verification.

## Capabilities
- **Bcrypt Hashing**: 12-round salted password hashing with constant-time verification.
- **JWT Cryptography**: HS256 access tokens (15-min TTL) and refresh tokens (30-day TTL) with revocation tracking.
- **Two-Factor SMS OTP**: Integrated with 2Factor.in SMS gateway for telephone number verification and OTP login.
- **Brute-Force Protection**: Redis-backed sliding-window rate limiting on `/login`, `/register`, and `/send-otp`.
"""

AUTH_TAGS = [
    {"name": "Authentication", "description": "User registration, password login, logout, and token refresh."},
    {"name": "Two-Factor OTP", "description": "SMS OTP dispatch and verification via 2Factor.in."},
    {"name": "Health", "description": "Service lifecycle and database connectivity health checks."},
]

app = FastAPI(
    title="FluxChat Authentication Service",
    version="1.0.0",
    description=AUTH_DESCRIPTION,
    openapi_tags=AUTH_TAGS,
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
    allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get(
    "/",
    response_model=RootResponse,
    tags=["Root"],
    summary="Root Service Endpoint",
)
async def root() -> RootResponse:
    db_connected = await db_manager.is_connected()
    return RootResponse(
        message=f"Welcome to {settings.APP_NAME}",
        service=settings.APP_NAME,
        database="connected" if db_connected else "disconnected",
        docs_url="/docs",
        health_url="/health",
    )


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Health"],
    summary="Root Health Check",
)
async def health() -> HealthResponse:
    db_connected = await db_manager.is_connected()
    return HealthResponse(
        status="ok" if db_connected else "degraded",
        database="connected" if db_connected else "disconnected",
        service=settings.APP_NAME,
        version="1.0.0",
        environment=settings.APP_ENV,
    )


from app.api.v1.router import probe_router

# Mount health probes at root (/health/live, /health/ready)
app.include_router(probe_router, prefix="/health")

from app.api.v1.auth import router as auth_router

# Mount versioned API routes (/api/v1/...)
app.include_router(api_router, prefix=settings.API_V1_STR)

# Also mount /auth directly as requested in Phase 3 specifications
app.include_router(auth_router, prefix="/auth")


