"""
Structured logging configuration for FluxChat API Gateway (Phase 22 compliant).
"""
import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from app.core.config import settings

SENSITIVE_KEYS = {"password", "token", "refresh_token", "authorization", "otp", "secret"}


def sanitize_dict(data: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively redacts sensitive keys."""
    sanitized = {}
    for k, v in data.items():
        if k.lower() in SENSITIVE_KEYS:
            sanitized[k] = "[REDACTED]"
        elif isinstance(v, dict):
            sanitized[k] = sanitize_dict(v)
        else:
            sanitized[k] = v
    return sanitized


class JsonFormatter(logging.Formatter):
    """Outputs structured JSON log records."""

    def format(self, record: logging.LogRecord) -> str:
        log_obj = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": "api-gateway",
            "level": record.levelname,
            "message": record.getMessage(),
        }
        if hasattr(record, "request_id"):
            log_obj["request_id"] = record.request_id
        if hasattr(record, "extra_data") and isinstance(record.extra_data, dict):
            log_obj.update(sanitize_dict(record.extra_data))
        return json.dumps(log_obj)


def setup_logging() -> logging.Logger:
    logger = logging.getLogger("FluxChat.ApiGateway")
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.INFO)
        formatter = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger


logger = setup_logging()
