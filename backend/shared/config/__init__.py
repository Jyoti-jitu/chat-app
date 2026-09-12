"""
Configuration package for shared settings and validators.
"""
from shared.config.validator import EnvironmentValidator, ConfigValidationError

__all__ = ["EnvironmentValidator", "ConfigValidationError"]
