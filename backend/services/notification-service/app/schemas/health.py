"""Health Check response schema for Notification Service."""
from typing import Optional
from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Health check payload structure."""

    status: str
    database: str
    service: str
    version: str
    environment: str
    error: Optional[str] = None
