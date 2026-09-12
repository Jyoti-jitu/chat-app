"""Shared error handling package for FluxChat."""
from .exceptions import (
    AppException,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    ValidationError,
    RateLimitError,
    BadGatewayError,
    ServiceUnavailableError,
)
from .handlers import register_exception_handlers

__all__ = [
    "AppException",
    "AuthenticationError",
    "AuthorizationError",
    "NotFoundError",
    "ConflictError",
    "ValidationError",
    "RateLimitError",
    "BadGatewayError",
    "ServiceUnavailableError",
    "register_exception_handlers",
]
