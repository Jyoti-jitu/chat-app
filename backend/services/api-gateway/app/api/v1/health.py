"""
Aggregated Cluster Health Check for FluxChat.
Probes all downstream microservices concurrently.
"""
import asyncio
import time
from datetime import datetime, timezone
from typing import Any, Dict
from fastapi import APIRouter
import httpx
from app.core.config import settings
from app.services.http_proxy import get_http_client

router = APIRouter()


async def check_service(name: str, url: str) -> Dict[str, Any]:
    """Checks an individual service's health endpoint with latency tracking."""
    client = get_http_client()
    start = time.perf_counter()
    try:
        resp = await client.get(url, timeout=3.0)
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        if resp.status_code == 200:
            data = resp.json()
            return {
                "name": name,
                "status": "healthy",
                "latency_ms": latency_ms,
                "details": data,
            }
        else:
            return {
                "name": name,
                "status": "unhealthy",
                "latency_ms": latency_ms,
                "error": f"HTTP {resp.status_code}",
            }
    except Exception as exc:
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        return {
            "name": name,
            "status": "unreachable",
            "latency_ms": latency_ms,
            "error": f"{type(exc).__name__}: {exc}",
            "target_url": url,
        }


@router.get("/health/live", summary="Gateway Liveness Probe", tags=["Health"])
async def gateway_liveness():
    """Service liveness probe for API Gateway."""
    return {
        "status": "ok",
        "service": settings.SERVICE_NAME,
        "uptime_seconds": round(time.perf_counter(), 2),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/health/ready", summary="Gateway Readiness Probe", tags=["Health"])
async def gateway_readiness():
    """Service readiness probe for API Gateway."""
    return {
        "status": "ok",
        "service": settings.SERVICE_NAME,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/health", summary="Cluster Health Aggregator", tags=["Health"])
async def cluster_health():
    """Returns aggregated cluster health across all 6 microservices."""
    ws_http_base = settings.WS_SERVICE_URL.replace("ws://", "http://").replace("wss://", "https://")

    services_to_probe = [
        ("auth-service", f"{settings.AUTH_SERVICE_URL.rstrip('/')}/health"),
        ("user-service", f"{settings.USER_SERVICE_URL.rstrip('/')}/health"),
        ("chat-service", f"{settings.CHAT_SERVICE_URL.rstrip('/')}/health"),
        ("message-service", f"{settings.MESSAGE_SERVICE_URL.rstrip('/')}/health"),
        ("websocket-service", f"{ws_http_base.rstrip('/')}/health"),
        ("notification-service", f"{settings.NOTIFICATION_SERVICE_URL.rstrip('/')}/health"),
    ]

    results = await asyncio.gather(*[check_service(name, url) for name, url in services_to_probe])

    all_healthy = all(r["status"] == "healthy" for r in results)
    unhealthy_count = sum(1 for r in results if r["status"] != "healthy")

    overall_status = "healthy" if all_healthy else ("degraded" if unhealthy_count < len(results) else "unhealthy")

    return {
        "status": overall_status,
        "service": settings.SERVICE_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {r["name"]: r for r in results},
    }

