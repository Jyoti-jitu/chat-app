"""
Custom Domain Exceptions for FluxChat (Phase 21 Standardized Error Handling).
"""
from typing import Any, Optional


class AppException(Exception):
    """Base application exception with standardized code and status code."""

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        status_code: int = 500,
        details: Optional[Any] = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details


class AuthenticationError(AppException):
    """Raised when authentication fails or token is missing/invalid (HTTP 401)."""

    def __init__(
        self,
        message: str = "Authentication credentials were invalid or missing.",
        details: Optional[Any] = None,
    ):
        super().__init__(
            message=message,
            code="AUTHENTICATION_FAILED",
            status_code=401,
            details=details,
        )


class AuthorizationError(AppException):
    """Raised when user lacks permission to access resource (HTTP 403)."""

    def __init__(
        self,
        message: str = "You do not have permission to perform this action.",
        details: Optional[Any] = None,
    ):
        super().__init__(
            message=message,
            code="PERMISSION_DENIED",
            status_code=403,
            details=details,
        )


class NotFoundError(AppException):
    """Raised when requested entity is not found in storage (HTTP 404)."""

    def __init__(
        self,
        message: str = "The requested resource was not found.",
        details: Optional[Any] = None,
    ):
        super().__init__(
            message=message,
            code="NOT_FOUND",
            status_code=404,
            details=details,
        )


class ConflictError(AppException):
    """Raised when a resource state conflict occurs, e.g. duplicate key (HTTP 409)."""

    def __init__(
        self,
        message: str = "A resource conflict occurred.",
        details: Optional[Any] = None,
    ):
        super().__init__(
            message=message,
            code="CONFLICT",
            status_code=409,
            details=details,
        )


class ValidationError(AppException):
    """Raised when request payload or params fail semantic validation (HTTP 422)."""

    def __init__(
        self,
        message: str = "Validation failed for request parameters.",
        details: Optional[Any] = None,
    ):
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=422,
            details=details,
        )


class RateLimitError(AppException):
    """Raised when client exceeds rate limit quota (HTTP 429)."""

    def __init__(
        self,
        message: str = "Rate limit exceeded. Please try again later.",
        retry_after: int = 60,
    ):
        super().__init__(
            message=message,
            code="RATE_LIMIT_EXCEEDED",
            status_code=429,
            details={"retry_after": retry_after},
        )
        self.retry_after = retry_after


class BadGatewayError(AppException):
    """Raised when upstream/downstream service is unreachable (HTTP 502)."""

    def __init__(
        self,
        message: str = "Downstream service is unavailable or returned an invalid response.",
        details: Optional[Any] = None,
    ):
        super().__init__(
            message=message,
            code="BAD_GATEWAY",
            status_code=502,
            details=details,
        )


class ServiceUnavailableError(AppException):
    """Raised when current service cannot handle request (HTTP 503)."""

    def __init__(
        self,
        message: str = "Service is temporarily unavailable.",
        details: Optional[Any] = None,
    ):
        super().__init__(
            message=message,
            code="SERVICE_UNAVAILABLE",
            status_code=503,
            details=details,
        )
