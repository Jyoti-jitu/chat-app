"""Health Check response schema for WebSocket Service."""
from typing import Optional
from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Health check payload structure."""

    status: str
    database: str
    service: str
    version: str
    environment: str
    active_users: int = 0
    active_connections: int = 0
    error: Optional[str] = None
