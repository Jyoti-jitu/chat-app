"""
FluxChat 12-Factor Environment Configuration Validator.
Enforces strict environment constraints, entropy validation for cryptographic secrets,
and scheme checks for database and broker connection strings.
"""

import os
import re
from typing import Dict, List, Optional, Tuple, Any
from urllib.parse import urlparse


class ConfigValidationError(Exception):
    """Raised when an environment configuration violates 12-factor safety rules."""
    def __init__(self, message: str, field: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.field = field
        self.details = details or {}


class EnvironmentValidator:
    """Validator for 12-factor application environment variables."""

    # Default developer placeholder patterns forbidden in production
    INSECURE_SECRET_PATTERNS = [
        r"dev-secret",
        r"change-this",
        r"replace-in-production",
        r"replace-with",
        r"secret-key-32-chars",
        r"default",
        r"password",
        r"123456",
    ]

    VALID_APP_ENVS = {"development", "staging", "production", "test"}
    VALID_LOG_LEVELS = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}

    @classmethod
    def validate_mongodb_url(cls, url: str) -> bool:
        """
        Validate MongoDB URI scheme and presence of host/replica set.
        Supports standard mongodb:// and SRV mongodb+srv://
        """
        if not url or not isinstance(url, str):
            raise ConfigValidationError("MONGODB_URL is missing or empty", field="MONGODB_URL")

        url_clean = url.strip()
        if not (url_clean.startswith("mongodb://") or url_clean.startswith("mongodb+srv://")):
            raise ConfigValidationError(
                f"Invalid MONGODB_URL scheme: must begin with 'mongodb://' or 'mongodb+srv://'",
                field="MONGODB_URL"
            )

        # Ensure hostname is present after scheme
        parsed = urlparse(url_clean)
        if not parsed.netloc and "@" not in url_clean:
            raise ConfigValidationError("MONGODB_URL lacks a valid hostname or replica set target", field="MONGODB_URL")

        return True

    @classmethod
    def validate_redis_url(cls, url: str) -> bool:
        """Validate Redis URI scheme (redis:// or rediss://)."""
        if not url or not isinstance(url, str):
            raise ConfigValidationError("REDIS_URL is missing or empty", field="REDIS_URL")

        url_clean = url.strip()
        if not (url_clean.startswith("redis://") or url_clean.startswith("rediss://")):
            raise ConfigValidationError(
                "Invalid REDIS_URL scheme: must begin with 'redis://' or 'rediss://'",
                field="REDIS_URL"
            )
        return True

    @classmethod
    def validate_jwt_secret(cls, secret: str, app_env: str = "development") -> Tuple[bool, str]:
        """
        Enforce cryptographic entropy requirements on JWT secret keys:
        1. Length must be >= 32 characters.
        2. In production, reject known developer default strings.
        """
        if not secret or not isinstance(secret, str):
            raise ConfigValidationError("JWT_SECRET is missing or empty", field="JWT_SECRET")

        secret_clean = secret.strip()
        if len(secret_clean) < 32:
            raise ConfigValidationError(
                f"JWT_SECRET is too short ({len(secret_clean)} characters). Minimum required is 32 characters.",
                field="JWT_SECRET"
            )

        normalized_env = app_env.lower().strip()
        if normalized_env == "production":
            for pattern in cls.INSECURE_SECRET_PATTERNS:
                if re.search(pattern, secret_clean, re.IGNORECASE):
                    raise ConfigValidationError(
                        f"Insecure default JWT_SECRET detected in production environment: matches pattern '{pattern}'. "
                        "You must configure a high-entropy cryptographically random secret.",
                        field="JWT_SECRET"
                    )

        return True, "Valid"

    @classmethod
    def validate_app_env(cls, env: str) -> str:
        """Validate application runtime environment."""
        if not env:
            return "development"
        clean_env = env.lower().strip()
        if clean_env not in cls.VALID_APP_ENVS:
            raise ConfigValidationError(
                f"Invalid APP_ENV '{env}'. Must be one of: {', '.join(cls.VALID_APP_ENVS)}",
                field="APP_ENV"
            )
        return clean_env

    @classmethod
    def validate_log_level(cls, level: str) -> str:
        """Validate standard logging level."""
        if not level:
            return "INFO"
        clean_level = level.upper().strip()
        if clean_level not in cls.VALID_LOG_LEVELS:
            raise ConfigValidationError(
                f"Invalid LOG_LEVEL '{level}'. Must be one of: {', '.join(cls.VALID_LOG_LEVELS)}",
                field="LOG_LEVEL"
            )
        return clean_level

    @classmethod
    def audit_environment(cls, env_dict: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Performs a comprehensive audit of active environment variables.
        Returns a dictionary with status, errors, warnings, and masked config.
        """
        env = env_dict if env_dict is not None else dict(os.environ)
        errors: List[Dict[str, str]] = []
        warnings: List[Dict[str, str]] = []
        app_env = env.get("APP_ENV", "development").lower().strip()

        # Check APP_ENV
        try:
            cls.validate_app_env(app_env)
        except ConfigValidationError as e:
            errors.append({"field": e.field or "APP_ENV", "error": str(e)})

        # Check MONGODB_URL
        mongo_url = env.get("MONGODB_URL", "")
        if mongo_url:
            try:
                cls.validate_mongodb_url(mongo_url)
            except ConfigValidationError as e:
                errors.append({"field": e.field or "MONGODB_URL", "error": str(e)})
        else:
            warnings.append({"field": "MONGODB_URL", "warning": "MONGODB_URL is not set in environment."})

        # Check REDIS_URL
        redis_url = env.get("REDIS_URL", "")
        if redis_url:
            try:
                cls.validate_redis_url(redis_url)
            except ConfigValidationError as e:
                errors.append({"field": e.field or "REDIS_URL", "error": str(e)})

        # Check JWT_SECRET
        jwt_secret = env.get("JWT_SECRET", "")
        if jwt_secret:
            try:
                cls.validate_jwt_secret(jwt_secret, app_env=app_env)
            except ConfigValidationError as e:
                errors.append({"field": e.field or "JWT_SECRET", "error": str(e)})
        else:
            errors.append({"field": "JWT_SECRET", "error": "JWT_SECRET is missing."})

        return {
            "status": "pass" if not errors else "fail",
            "app_env": app_env,
            "error_count": len(errors),
            "warning_count": len(warnings),
            "errors": errors,
            "warnings": warnings,
        }
