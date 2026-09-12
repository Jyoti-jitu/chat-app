"""
Unit tests for 12-Factor EnvironmentValidator.
"""

import pytest
from shared.config.validator import EnvironmentValidator, ConfigValidationError


def test_validate_mongodb_url_success():
    """Test standard and SRV connection strings."""
    assert EnvironmentValidator.validate_mongodb_url("mongodb://localhost:27017/fluxchat_db") is True
    assert EnvironmentValidator.validate_mongodb_url(
        "mongodb+srv://user:pass@cluster.mongodb.net/fluxchat_db?retryWrites=true"
    ) is True


def test_validate_mongodb_url_failure():
    """Test malformed schemes and empty URLs."""
    with pytest.raises(ConfigValidationError, match="missing or empty"):
        EnvironmentValidator.validate_mongodb_url("")

    with pytest.raises(ConfigValidationError, match="Invalid MONGODB_URL scheme"):
        EnvironmentValidator.validate_mongodb_url("postgres://user:pass@localhost:5432/db")


def test_validate_redis_url_success():
    """Test redis and rediss SSL schemes."""
    assert EnvironmentValidator.validate_redis_url("redis://localhost:6379/0") is True
    assert EnvironmentValidator.validate_redis_url("rediss://default:secret@redis.internal:6380/0") is True


def test_validate_redis_url_failure():
    """Test invalid Redis schemes."""
    with pytest.raises(ConfigValidationError, match="Invalid REDIS_URL scheme"):
        EnvironmentValidator.validate_redis_url("http://localhost:6379")


def test_validate_jwt_secret_length():
    """Test minimum 32-character requirement."""
    # Too short (< 32 chars)
    with pytest.raises(ConfigValidationError, match="too short"):
        EnvironmentValidator.validate_jwt_secret("short-secret-key-123")

    # Sufficient length (>= 32 chars)
    valid, _ = EnvironmentValidator.validate_jwt_secret(
        "very-long-production-grade-secret-key-that-has-over-32-characters"
    )
    assert valid is True


def test_validate_jwt_secret_production_guardrail():
    """Test rejection of default developer placeholders in production mode."""
    # In development, default strings are tolerated
    valid, _ = EnvironmentValidator.validate_jwt_secret(
        "fluxchat-dev-secret-key-32-chars-minimum-replace-in-production",
        app_env="development",
    )
    assert valid is True

    # In production, default strings trigger strict failure
    with pytest.raises(ConfigValidationError, match="Insecure default JWT_SECRET detected"):
        EnvironmentValidator.validate_jwt_secret(
            "fluxchat-dev-secret-key-32-chars-minimum-replace-in-production",
            app_env="production",
        )


def test_validate_app_env():
    """Test application environment parsing."""
    assert EnvironmentValidator.validate_app_env("production") == "production"
    assert EnvironmentValidator.validate_app_env("DEVELOPMENT") == "development"
    assert EnvironmentValidator.validate_app_env("staging") == "staging"

    with pytest.raises(ConfigValidationError, match="Invalid APP_ENV"):
        EnvironmentValidator.validate_app_env("invalid_env")


def test_validate_log_level():
    """Test log level parsing."""
    assert EnvironmentValidator.validate_log_level("info") == "INFO"
    assert EnvironmentValidator.validate_log_level("DEBUG") == "DEBUG"

    with pytest.raises(ConfigValidationError, match="Invalid LOG_LEVEL"):
        EnvironmentValidator.validate_log_level("VERBOSE")


def test_audit_environment():
    """Test full environment dictionary audit."""
    valid_env = {
        "APP_ENV": "development",
        "MONGODB_URL": "mongodb://localhost:27017",
        "REDIS_URL": "redis://localhost:6379/0",
        "JWT_SECRET": "a" * 32,
    }
    result = EnvironmentValidator.audit_environment(valid_env)
    assert result["status"] == "pass"
    assert result["error_count"] == 0

    invalid_env = {
        "APP_ENV": "production",
        "MONGODB_URL": "invalid-url",
        "JWT_SECRET": "dev-secret-12345678901234567890123",
    }
    result_fail = EnvironmentValidator.audit_environment(invalid_env)
    assert result_fail["status"] == "fail"
    assert result_fail["error_count"] >= 2
