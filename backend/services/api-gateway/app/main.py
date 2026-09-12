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
from app.services.http_proxy import get_http_client, close_http_client
from app.services.ws_proxy import proxy_websocket
from app.api.v1.router import api_router
from app.api.v1.health import cluster_health


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info(f"Starting {settings.SERVICE_NAME} v{settings.VERSION} on port {settings.PORT}...")
    _ = get_http_client()
    yield
    # Shutdown
    logger.info(f"Shutting down {settings.SERVICE_NAME}...")
    await close_http_client()


app = FastAPI(
    title=settings.SERVICE_NAME,
    version=settings.VERSION,
    description="Central API Gateway, reverse proxy, and WebSocket tunnel for FluxChat microservices.",
    lifespan=lifespan,
)


class GatewayMiddleware(BaseHTTPMiddleware):
    """
    Handles request ID tagging, rate limiting, and structured access logging.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.perf_counter()

        # Tag request ID
        req_id = request.headers.get("x-request-id") or f"req_{uuid.uuid4().hex[:12]}"

        # Bypass rate limit on health checks
        path = request.url.path
        if path in ("/health", "/api/v1/health", "/docs", "/openapi.json"):
            response = await call_next(request)
            response.headers["x-request-id"] = req_id
            return response

        # Client IP extraction
        client_ip = request.client.host if request.client else "127.0.0.1"
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()

        # Determine rate limit quota
        if path.startswith("/api/v1/auth"):
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
                        }
                    },
                )
        else:
            limit_val, remaining, reset_sec = limit, limit, 60

        # Execute downstream
        response = await call_next(request)

        # Inject telemetry headers
        response.headers["x-request-id"] = req_id
        response.headers["x-ratelimit-limit"] = str(limit_val)
        response.headers["x-ratelimit-remaining"] = str(remaining)
        response.headers["x-ratelimit-reset"] = str(reset_sec)

        # Access log
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

# Root Health Endpoints
@app.get("/health", tags=["health"])
async def root_health():
    return await cluster_health()


# WebSocket Tunnel Endpoints
@app.websocket("/ws")
@app.websocket("/api/v1/ws")
async def websocket_proxy_endpoint(websocket: WebSocket):
    await proxy_websocket(websocket)


# Mount API v1 Routes
app.include_router(api_router, prefix="/api/v1")
