"""
Health check response schemas for FluxChat Message Service.
"""
from typing import Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Service health response contract."""
    status: str = Field(..., json_schema_extra={"example": "ok"})
    database: str = Field(..., json_schema_extra={"example": "connected"})
    service: str = Field(..., json_schema_extra={"example": "FluxChat Message Service"})
    version: str = Field("1.0.0", json_schema_extra={"example": "1.0.0"})
    environment: str = Field(..., json_schema_extra={"example": "development"})
    error: Optional[str] = Field(None, json_schema_extra={"example": None})
