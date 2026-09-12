"""
Standardized FastAPI Exception Handlers (Phase 21 Compliant).
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import JSONResponse

from .exceptions import AppException

logger = logging.getLogger("FluxChat.Shared.ErrorHandlers")

STATUS_CODE_TO_ERROR_CODE = {
    400: "BAD_REQUEST",
    401: "AUTHENTICATION_FAILED",
    403: "PERMISSION_DENIED",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMIT_EXCEEDED",
    500: "INTERNAL_SERVER_ERROR",
    502: "BAD_GATEWAY",
    503: "SERVICE_UNAVAILABLE",
    504: "GATEWAY_TIMEOUT",
}


def build_error_payload(
    code: str,
    message: str,
    request_id: str,
    details: Optional[Any] = None,
) -> Dict[str, Any]:
    """Constructs canonical Phase 21 error dictionary."""
    error_obj: Dict[str, Any] = {
        "code": code,
        "message": message,
        "request_id": request_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if details is not None:
        error_obj["details"] = details

    # Return error envelope with backward-compatible top-level detail
    return {
        "error": error_obj,
        "detail": message if details is None else details,
    }


def get_request_id(request: Request) -> str:
    """Extracts or generates an X-Request-ID."""
    return request.headers.get("x-request-id") or f"req_{uuid.uuid4().hex[:12]}"


def register_exception_handlers(app: FastAPI) -> None:
    """Registers global error handlers conforming to Phase 21 specification."""

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        req_id = get_request_id(request)
        payload = build_error_payload(
            code=exc.code,
            message=exc.message,
            request_id=req_id,
            details=exc.details,
        )
        headers = {"x-request-id": req_id}
        if isinstance(exc.details, dict) and "retry_after" in exc.details:
            headers["retry-after"] = str(exc.details["retry_after"])

        return JSONResponse(
            status_code=exc.status_code,
            content=payload,
            headers=headers,
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        req_id = get_request_id(request)
        code = STATUS_CODE_TO_ERROR_CODE.get(exc.status_code, "HTTP_ERROR")
        msg = exc.detail if isinstance(exc.detail, str) else "An HTTP error occurred."
        details = exc.detail if not isinstance(exc.detail, str) else None

        payload = build_error_payload(
            code=code,
            message=msg,
            request_id=req_id,
            details=details,
        )
        headers = {"x-request-id": req_id}
        if exc.headers:
            headers.update(exc.headers)

        return JSONResponse(
            status_code=exc.status_code,
            content=payload,
            headers=headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        req_id = get_request_id(request)
        # Clean Pydantic error details
        errors = exc.errors()
        err_details = []
        for err in errors:
            loc = " -> ".join(str(l) for l in err.get("loc", []))
            err_details.append({
                "field": loc,
                "type": err.get("type", "value_error"),
                "message": err.get("msg", "Invalid value"),
            })

        payload = build_error_payload(
            code="VALIDATION_ERROR",
            message="Request payload or parameters validation failed.",
            request_id=req_id,
            details=err_details,
        )
        return JSONResponse(
            status_code=422,
            content=payload,
            headers={"x-request-id": req_id},
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        req_id = get_request_id(request)
        logger.exception(f"Unhandled server exception [req_id={req_id}]: {exc}")
        payload = build_error_payload(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected internal server error occurred.",
            request_id=req_id,
        )
        return JSONResponse(
            status_code=500,
            content=payload,
            headers={"x-request-id": req_id},
        )
