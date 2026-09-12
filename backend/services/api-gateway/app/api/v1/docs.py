"""
API Gateway Documentation Aggregator.
Proxies and aggregates OpenAPI specifications from all downstream microservices.
"""

from typing import Dict, Any
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
import httpx

from app.core.config import settings
from app.core.logging import logger
from app.services.http_proxy import get_http_client

docs_router = APIRouter(prefix="/docs", tags=["API Documentation"])

# Downstream service mapping
SERVICE_URLS: Dict[str, str] = {
    "auth-service": settings.AUTH_SERVICE_URL,
    "user-service": settings.USER_SERVICE_URL,
    "chat-service": settings.CHAT_SERVICE_URL,
    "message-service": settings.MESSAGE_SERVICE_URL,
    "websocket-service": settings.WS_SERVICE_URL.replace("ws://", "http://").replace("wss://", "https://"),
    "notification-service": settings.NOTIFICATION_SERVICE_URL,
}


@docs_router.get(
    "/{service_name}/openapi.json",
    summary="Get Microservice OpenAPI Schema",
    description="Proxies and returns the raw OpenAPI 3.1 JSON specification for the requested downstream microservice.",
    response_class=JSONResponse,
)
async def get_service_openapi(service_name: str) -> Dict[str, Any]:
    """Retrieve OpenAPI specification for an individual microservice."""
    base_url = SERVICE_URLS.get(service_name.lower().strip())
    if not base_url:
        raise HTTPException(
            status_code=404,
            detail=f"Service '{service_name}' not found. Available: {', '.join(SERVICE_URLS.keys())}",
        )

    target_url = f"{base_url.rstrip('/')}/openapi.json"
    client = get_http_client()

    try:
        resp = await client.get(target_url, timeout=5.0)
        if resp.status_code == 200:
            return resp.json()
        logger.warning(f"Downstream service {service_name} returned status {resp.status_code} for openapi.json")
        raise HTTPException(status_code=resp.status_code, detail=f"Downstream {service_name} openapi.json failed")
    except httpx.RequestError as exc:
        logger.error(f"Failed to fetch openapi.json from {service_name} at {target_url}: {exc}")
        return {
            "openapi": "3.1.0",
            "info": {
                "title": f"FluxChat {service_name.title()}",
                "version": "1.0.0",
                "description": f"Microservice {service_name} is currently offline or unreachable. Target: {target_url}",
            },
            "paths": {},
        }
