"""
Structured JSON Logging for FluxChat (Phase 22 Compliant).
Enforces RFC 3339 timestamps, distributed request IDs, and automatic credential sanitization.
"""
import json
import logging
import sys
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Set
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

SENSITIVE_KEYS: Set[str] = {
    "password",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
    "otp",
    "secret",
    "api_key",
    "apiKey",
}


def sanitize_dict(data: Any) -> Any:
    """Recursively redacts sensitive keys from dictionaries or lists."""
    if isinstance(data, dict):
        sanitized = {}
        for k, v in data.items():
            if str(k).lower() in SENSITIVE_KEYS or any(s in str(k).lower() for s in ("password", "secret", "token")):
                sanitized[k] = "[REDACTED]"
            else:
                sanitized[k] = sanitize_dict(v)
        return sanitized
    elif isinstance(data, list):
        return [sanitize_dict(item) for item in data]
    return data


class JsonFormatter(logging.Formatter):
    """Outputs log events formatted as single-line JSON records."""

    def __init__(self, service_name: str):
        super().__init__()
        self.service_name = service_name

    def format(self, record: logging.LogRecord) -> str:
        log_obj: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": self.service_name,
            "level": record.levelname,
            "message": record.getMessage(),
        }

        # Attach request_id if present
        if hasattr(record, "request_id"):
            log_obj["request_id"] = record.request_id

        # Attach user_id if present
        if hasattr(record, "user_id"):
            log_obj["user_id"] = record.user_id

        # Attach any extra data passed to logger
        if hasattr(record, "extra_data") and isinstance(record.extra_data, dict):
            log_obj.update(sanitize_dict(record.extra_data))

        # Attach exception info if present
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_obj)


def get_logger(service_name: str, level: int = logging.INFO) -> logging.Logger:
    """Factory creating or retrieving a structured JSON logger for a service."""
    logger_name = f"FluxChat.{service_name}"
    logger = logging.getLogger(logger_name)
    logger.setLevel(level)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(level)
        handler.setFormatter(JsonFormatter(service_name))
        logger.addHandler(handler)
        logger.propagate = False

    return logger


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware logging every HTTP request with request ID, duration, and client details.
    """

    def __init__(self, app, service_name: str):
        super().__init__(app)
        self.logger = get_logger(service_name)

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.perf_counter()
        req_id = request.headers.get("x-request-id") or f"req_{uuid.uuid4().hex[:12]}"

        # Forward request
        response = await call_next(request)

        # Calculate latency
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        response.headers["x-request-id"] = req_id

        # Access log record
        client_ip = request.client.host if request.client else "unknown"
        extra = {
            "request_id": req_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
            "client_ip": client_ip,
        }

        # Don't excessively log health checks in development
        if request.url.path not in ("/health", "/api/v1/health"):
            record = logging.LogRecord(
                name=self.logger.name,
                level=logging.INFO,
                pathname="",
                lineno=0,
                msg=f"{request.method} {request.url.path} -> {response.status_code} ({duration_ms}ms)",
                args=(),
                exc_info=None,
            )
            record.request_id = req_id
            record.extra_data = extra
            self.logger.handle(record)

        return response
