"""
Health check response schemas for User Service.
"""
from typing import Optional
from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Health check status representation."""
    status: str
    service: str
    version: str
    environment: str
    database: Optional[str] = "unknown"
