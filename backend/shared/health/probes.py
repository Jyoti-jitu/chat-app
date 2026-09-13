"""
Reusable Health Probes Infrastructure for FluxChat Microservices.
Provides standardized liveness and readiness endpoints with accurate HTTP status codes.
"""
import time
from datetime import datetime, timezone
from typing import Callable, Awaitable, Optional, Dict, Any
from fastapi import APIRouter, Response, status
from shared.health.schemas import LivenessResponse, ReadinessResponse

# Process start time for uptime calculation
_SERVICE_START_TIME = time.time()


def get_uptime_seconds() -> float:
    """Returns uptime in seconds since process start."""
    return round(time.time() - _SERVICE_START_TIME, 2)


def create_health_probe_router(
    service_name: str,
    db_check: Optional[Callable[[], Awaitable[bool]]] = None,
    redis_check: Optional[Callable[[], Awaitable[bool]]] = None,
    extra_checks: Optional[Dict[str, Callable[[], Awaitable[bool]]]] = None,
    tags: Optional[list] = None,
) -> APIRouter:
    """
    Creates a standardized FastAPI router containing:
      - GET /live: Service Liveness Probe (always 200 OK if event loop is alive)
      - GET /ready: Service Readiness Probe (200 OK when ready, 503 when dependencies fail)
    """
    router = APIRouter(tags=tags or ["Health"])

    @router.get(
        "/live",
        response_model=LivenessResponse,
        status_code=status.HTTP_200_OK,
        summary="Service Liveness Probe",
        description="Verifies the process is alive and responding. Never queries downstream databases to avoid cascading restarts.",
    )
    async def liveness_probe() -> LivenessResponse:
        return LivenessResponse(
            status="ok",
            service=service_name,
            uptime_seconds=get_uptime_seconds(),
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    @router.get(
        "/ready",
        response_model=ReadinessResponse,
        responses={
            200: {"description": "Service is ready to accept traffic"},
            503: {"description": "One or more critical dependencies are unavailable"},
        },
        summary="Service Readiness Probe",
        description="Verifies all required backing services (e.g. MongoDB, Redis) are healthy before routing traffic.",
    )
    async def readiness_probe(response: Response) -> ReadinessResponse:
        all_ready = True
        db_status = None
        redis_status = None
        dep_statuses: Dict[str, Any] = {}
        error_messages = []

        # 1. MongoDB connectivity check
        if db_check is not None:
            try:
                is_connected = await db_check()
                db_status = "connected" if is_connected else "disconnected"
                if not is_connected:
                    all_ready = False
                    error_messages.append("MongoDB connection not ready")
            except Exception as exc:
                db_status = "error"
                all_ready = False
                error_messages.append(f"MongoDB check error: {exc}")

        # 2. Redis connectivity check
        if redis_check is not None:
            try:
                is_connected = await redis_check()
                redis_status = "connected" if is_connected else "disconnected"
                if not is_connected:
                    all_ready = False
                    error_messages.append("Redis connection not ready")
            except Exception as exc:
                redis_status = "error"
                all_ready = False
                error_messages.append(f"Redis check error: {exc}")

        # 3. Any additional checks
        if extra_checks:
            for check_name, checker in extra_checks.items():
                try:
                    res = await checker()
                    dep_statuses[check_name] = "ok" if res else "unready"
                    if not res:
                        all_ready = False
                        error_messages.append(f"Dependency {check_name} not ready")
                except Exception as exc:
                    dep_statuses[check_name] = f"error: {exc}"
                    all_ready = False
                    error_messages.append(f"Dependency {check_name} error: {exc}")

        if not all_ready:
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
            return ReadinessResponse(
                status="unready",
                service=service_name,
                database=db_status,
                redis=redis_status,
                dependencies=dep_statuses if dep_statuses else None,
                error="; ".join(error_messages) if error_messages else "Dependencies unready",
                timestamp=datetime.now(timezone.utc).isoformat(),
            )

        return ReadinessResponse(
            status="ok",
            service=service_name,
            database=db_status,
            redis=redis_status,
            dependencies=dep_statuses if dep_statuses else None,
            error=None,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    return router
