"""
HTTP reverse proxy service using httpx.AsyncClient.
"""
from datetime import datetime, timezone
import uuid
from typing import Optional
import httpx
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
from app.core.config import settings
from app.core.logging import logger

HOP_BY_HOP_HEADERS = {
    "host",
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "upgrade",
    "transfer-encoding",
}

# Global reusable async client for connection pooling
http_client: Optional[httpx.AsyncClient] = None


def get_http_client() -> httpx.AsyncClient:
    global http_client
    if http_client is None or http_client.is_closed:
        http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(settings.PROXY_TIMEOUT_SECONDS, connect=5.0),
            follow_redirects=True,
            limits=httpx.Limits(max_keepalive_connections=100, max_connections=500),
        )
    return http_client


async def close_http_client() -> None:
    global http_client
    if http_client is not None and not http_client.is_closed:
        await http_client.aclose()
        http_client = None


async def proxy_request(request: Request, target_base_url: str, request_id: Optional[str] = None) -> Response:
    """
    Forwards an incoming Starlette request to target_base_url.
    Preserves method, query parameters, body, headers, and returns response.
    """
    req_id = request_id or request.headers.get("x-request-id") or f"req_{uuid.uuid4().hex[:12]}"
    client = get_http_client()

    # Construct target URL
    target_url = f"{target_base_url.rstrip('/')}{request.url.path}"
    if request.url.query:
        target_url = f"{target_url}?{request.url.query}"

    # Build upstream headers
    forward_headers = {}
    for header_name, header_value in request.headers.items():
        if header_name.lower() not in HOP_BY_HOP_HEADERS:
            forward_headers[header_name] = header_value

    client_ip = request.client.host if request.client else "unknown"
    existing_forwarded = request.headers.get("x-forwarded-for")
    forward_headers["x-forwarded-for"] = f"{existing_forwarded}, {client_ip}" if existing_forwarded else client_ip
    forward_headers["x-forwarded-proto"] = request.url.scheme
    forward_headers["x-forwarded-host"] = request.headers.get("host", "localhost:8000")
    forward_headers["x-request-id"] = req_id

    # Read body
    body = await request.body()

    try:
        upstream_resp = await client.request(
            method=request.method,
            url=target_url,
            headers=forward_headers,
            content=body,
        )

        # Prepare response headers (strip hop-by-hop)
        resp_headers = {}
        for k, v in upstream_resp.headers.items():
            if k.lower() not in HOP_BY_HOP_HEADERS and k.lower() != "content-length":
                resp_headers[k] = v
        resp_headers["x-request-id"] = req_id

        return Response(
            content=upstream_resp.content,
            status_code=upstream_resp.status_code,
            headers=resp_headers,
            media_type=upstream_resp.headers.get("content-type"),
        )

    except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
        logger.error(f"Failed to connect to upstream service at {target_base_url}: {exc}")
        return JSONResponse(
            status_code=502,
            headers={"x-request-id": req_id},
            content={
                "error": {
                    "code": "BAD_GATEWAY",
                    "message": f"Upstream service at {target_base_url} is unavailable or unreachable.",
                    "request_id": req_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
    except httpx.TimeoutException as exc:
        logger.error(f"Timeout communicating with upstream service at {target_base_url}: {exc}")
        return JSONResponse(
            status_code=504,
            headers={"x-request-id": req_id},
            content={
                "error": {
                    "code": "GATEWAY_TIMEOUT",
                    "message": f"Upstream service at {target_base_url} timed out.",
                    "request_id": req_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
    except Exception as exc:
        logger.exception(f"Unexpected error proxying to {target_url}: {exc}")
        return JSONResponse(
            status_code=500,
            headers={"x-request-id": req_id},
            content={
                "error": {
                    "code": "INTERNAL_GATEWAY_ERROR",
                    "message": str(exc),
                    "request_id": req_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
