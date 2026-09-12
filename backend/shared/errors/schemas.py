"""
Standard Pydantic schemas for canonical Phase 21 error JSON envelopes.
Provides OpenAPI-ready schema documentation for all FluxChat microservices.
"""

from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    """Detailed error object inside canonical error response."""
    code: str = Field(
        ...,
        description="Machine-readable error code (e.g. AUTHENTICATION_FAILED, USER_NOT_FOUND)",
        examples=["AUTHENTICATION_FAILED"]
    )
    message: str = Field(
        ...,
        description="Human-readable explanation of the error",
        examples=["Invalid credentials or missing Bearer token"]
    )
    request_id: Optional[str] = Field(
        None,
        description="Distributed tracing identifier for cross-service request correlation",
        examples=["req_7f9b8c12a4"]
    )
    timestamp: Optional[str] = Field(
        None,
        description="ISO 8601 UTC timestamp of when the error occurred",
        examples=["2026-09-12T19:00:00Z"]
    )
    details: Optional[Dict[str, Any]] = Field(
        None,
        description="Optional field-level validation errors or context data"
    )


class ErrorResponse(BaseModel):
    """Canonical Phase 21 Error JSON Envelope."""
    error: ErrorDetail
    detail: str = Field(
        ...,
        description="Backward-compatible detail string mirroring error.message",
        examples=["Invalid credentials or missing Bearer token"]
    )


# Reusable OpenAPI error responses dictionary for FastAPI routes
STANDARD_OPENAPI_RESPONSES: Dict[int, Dict[str, Any]] = {
    400: {
        "model": ErrorResponse,
        "description": "Bad Request — Client payload failed schema or business validation.",
    },
    401: {
        "model": ErrorResponse,
        "description": "Unauthorized — Missing, expired, or malformed JWT Bearer token.",
    },
    403: {
        "model": ErrorResponse,
        "description": "Forbidden — Authenticated user lacks permission or ownership.",
    },
    404: {
        "model": ErrorResponse,
        "description": "Not Found — The requested resource does not exist.",
    },
    409: {
        "model": ErrorResponse,
        "description": "Conflict — Resource already exists (e.g. duplicate username/email).",
    },
    429: {
        "model": ErrorResponse,
        "description": "Too Many Requests — Rate limit quota exceeded. Retry-After header sent.",
    },
    500: {
        "model": ErrorResponse,
        "description": "Internal Server Error — Unexpected error occurred on server.",
    },
    502: {
        "model": ErrorResponse,
        "description": "Bad Gateway — Downstream microservice unreachable or returned error.",
    },
}
