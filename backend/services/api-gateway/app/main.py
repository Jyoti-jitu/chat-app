"""
FluxChat API Gateway Main Application.
"""
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import time
import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response
from starlette.websockets import WebSocket

from app.core.config import settings
from app.core.logging import logger
from app.core.rate_limiter import rate_limiter
from app.services.http_proxy import get_http_client, close_http_client, proxy_request
from app.services.ws_proxy import proxy_websocket
from app.api.v1.router import api_router
from app.api.v1.health import cluster_health, gateway_liveness, gateway_readiness
from shared.errors.handlers import register_exception_handlers



@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info(f"Starting {settings.SERVICE_NAME} v{settings.VERSION} on port {settings.PORT}...")
    _ = get_http_client()
    yield
    # Shutdown
    logger.info(f"Shutting down {settings.SERVICE_NAME}...")
    await close_http_client()


GATEWAY_DESCRIPTION = """
# 🚀 FluxChat Enterprise API Gateway

The **FluxChat API Gateway** acts as the single unified ingress point for the entire FluxChat microservice cluster.

## Architecture Overview
- **Reverse Proxy**: Routes `/api/v1/*` to individual microservices with transparent distributed tracing (`X-Request-ID`).
- **WebSocket Tunnel**: Upgrades and tunnels real-time socket connections on `/ws` to the WebSocket Service (`:8005`).
- **Sliding-Window Rate Limiting**: Enforces client-specific rate limits with standard RFC quota headers.
- **Cluster Health Aggregator**: Probes downstream service health concurrently on `/health`.

## Microservices Ingress Matrix
| Prefix | Downstream Target | Description |
|---|---|---|
| `/api/v1/auth` | **Auth Service** (`:8001`) | User registration, login, JWT issuance, 2Factor SMS OTP |
| `/api/v1/users` | **User Service** (`:8002`) | User profiles, directory search, account settings |
| `/api/v1/contacts` | **User Service** (`:8002`) | Bilateral contact requests, accept/reject, roster query |
| `/api/v1/conversations` | **Chat Service** (`:8003`) | 1:1 direct chats and group channels |
| `/api/v1/messages` | **Message Service** (`:8004`) | Messages, replies, cursor pagination, reactions |
| `/ws` & `/api/v1/ws` | **WebSocket Service** (`:8005`) | Real-time message events, presence, typing indicators |
| `/api/v1/notifications`| **Notification Service** (`:8006`)| Alert inbox, category filters, unread counters |

## Interactive Documentation Explorer
Use the dropdown selector at the top right to switch between the **Unified Gateway Ingress** and any downstream microservice specification.
"""

TAGS_METADATA = [
    {"name": "health", "description": "Composite cluster health monitoring and downstream latency tracking."},
    {"name": "API Documentation", "description": "Downstream microservice OpenAPI schemas and specifications."},
    {"name": "auth", "description": "Authentication, JWT tokens, and 2Factor SMS endpoints."},
    {"name": "users", "description": "User profile retrieval, account settings, and directory search."},
    {"name": "contacts", "description": "Contact requests, bilateral friendship management, and roster."},
    {"name": "conversations", "description": "Direct 1:1 messaging channels and group conversations."},
    {"name": "messages", "description": "Message dispatch, edit, soft-delete, and cursor pagination."},
    {"name": "notifications", "description": "Persistent notification center and unread alerts."},
    {"name": "presence", "description": "Real-time user online/offline/away status tracking."},
]

app = FastAPI(
    title="FluxChat Enterprise API Gateway",
    version=settings.VERSION,
    description=GATEWAY_DESCRIPTION,
    lifespan=lifespan,
    openapi_tags=TAGS_METADATA,
    docs_url="/docs",
    redoc_url="/redoc",
    swagger_ui_parameters={
        "urls": [
            {"name": "Unified Gateway Ingress", "url": "/openapi.json"},
            {"name": "Auth Service (:8001)", "url": "/api/v1/docs/auth-service/openapi.json"},
            {"name": "User Service (:8002)", "url": "/api/v1/docs/user-service/openapi.json"},
            {"name": "Chat Service (:8003)", "url": "/api/v1/docs/chat-service/openapi.json"},
            {"name": "Message Service (:8004)", "url": "/api/v1/docs/message-service/openapi.json"},
            {"name": "WebSocket Service (:8005)", "url": "/api/v1/docs/websocket-service/openapi.json"},
            {"name": "Notification Service (:8006)", "url": "/api/v1/docs/notification-service/openapi.json"},
        ],
        "persistAuthorization": True,
        "displayRequestDuration": True,
        "filter": True,
    },
)

register_exception_handlers(app)



class GatewayMiddleware(BaseHTTPMiddleware):
    """
    Handles request ID tagging, rate limiting, and structured access logging.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.perf_counter()

        # Tag request ID
        req_id = request.headers.get("x-request-id") or f"req_{uuid.uuid4().hex[:12]}"

        # Bypass rate limit on health checks and root
        path = request.url.path
        if path in (
            "/",
            "/health",
            "/health/live",
            "/health/ready",
            "/api/v1/health",
            "/api/v1/health/live",
            "/api/v1/health/ready",
            "/docs",
            "/openapi.json",
        ):
            response = await call_next(request)
            response.headers["x-request-id"] = req_id
            return response

        # Client IP extraction
        client_ip = request.client.host if request.client else "127.0.0.1"
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()

        # Determine rate limit quota
        if path.startswith("/api/v1/auth") or path.startswith("/auth"):
            limit = settings.RATE_LIMIT_AUTH
            bucket_key = f"auth:{client_ip}"
        else:
            limit = settings.RATE_LIMIT_DEFAULT
            bucket_key = f"gen:{client_ip}"

        if settings.RATE_LIMIT_ENABLED:
            allowed, limit_val, remaining, reset_sec = rate_limiter.check(bucket_key, limit)
            if not allowed:
                logger.warning(f"Rate limit exceeded for IP {client_ip} on {path}")
                headers = {
                    "x-request-id": req_id,
                    "x-ratelimit-limit": str(limit_val),
                    "x-ratelimit-remaining": "0",
                    "x-ratelimit-reset": str(reset_sec),
                    "retry-after": str(reset_sec),
                }
                return JSONResponse(
                    status_code=429,
                    headers=headers,
                    content={
                        "error": {
                            "code": "TOO_MANY_REQUESTS",
                            "message": f"Rate limit exceeded. Please try again in {reset_sec} seconds.",
                            "request_id": req_id,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        },
                        "detail": f"Rate limit exceeded. Please try again in {reset_sec} seconds.",
                    },
                )
        else:
            limit_val, remaining, reset_sec = limit, limit, 60

        response = await call_next(request)

        # Propagate request ID & Rate Limit headers
        response.headers["x-request-id"] = req_id
        if settings.RATE_LIMIT_ENABLED:
            response.headers["x-ratelimit-limit"] = str(limit_val)
            response.headers["x-ratelimit-remaining"] = str(remaining)
            response.headers["x-ratelimit-reset"] = str(reset_sec)

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.info(
            f"{request.method} {path} -> {response.status_code} ({duration_ms}ms) [req_id={req_id}, ip={client_ip}]"
        )

        return response


# Add Middleware
app.add_middleware(GatewayMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["x-request-id", "x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset"],
)

# Root Descriptor, Health & Probe Endpoints
@app.get("/", tags=["Descriptor"])
async def root_descriptor():
    return {
        "service": "FluxChat API Gateway",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "docs_url": "/docs",
        "health_url": "/health",
        "services_url": "/api/v1/gateway/services",
    }


@app.get("/health", tags=["Health"])
async def root_health():
    return await cluster_health()


@app.get("/health/live", tags=["Health"])
async def root_liveness():
    return await gateway_liveness()


@app.get("/health/ready", tags=["Health"])
async def root_readiness():
    return await gateway_readiness()


# WebSocket Tunnel Endpoints
@app.websocket("/ws")
@app.websocket("/api/v1/ws")
async def websocket_proxy_endpoint(websocket: WebSocket):
    await proxy_websocket(websocket)


# Mount API v1 Routes
app.include_router(api_router, prefix="/api/v1")

# Direct /auth proxy for frontend compatibility (/auth/send-otp, /auth/verify-otp, etc.)
AUTH_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]


@app.api_route("/auth", methods=AUTH_METHODS, tags=["auth"])
@app.api_route("/auth/{subpath:path}", methods=AUTH_METHODS, tags=["auth"])
async def proxy_direct_auth(request: Request, subpath: str = ""):
    return await proxy_request(request, settings.AUTH_SERVICE_URL)

