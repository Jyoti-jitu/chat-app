"""
Standardized Health Probe Schemas for Kubernetes & Cloud Ingress.
Defines contracts for Liveness (/health/live) and Readiness (/health/ready).
"""
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field


class LivenessResponse(BaseModel):
    """
    Contract for Kubernetes Liveness Probe.
    Indicates whether the process is alive, the event loop is ticking,
    and the application is responsive to HTTP requests.
    Does NOT query external dependencies to avoid cascading restarts.
    """
    status: str = Field("ok", description="Overall liveness status ('ok')", json_schema_extra={"example": "ok"})
    service: str = Field(..., description="Service identifier", json_schema_extra={"example": "FluxChat User Service"})
    uptime_seconds: float = Field(..., description="Uptime duration in seconds since process startup", json_schema_extra={"example": 142.85})
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="RFC 3339 UTC timestamp",
        json_schema_extra={"example": "2026-09-12T20:00:00.000000Z"},
    )


class ReadinessResponse(BaseModel):
    """
    Contract for Kubernetes Readiness Probe.
    Indicates whether the service is ready to accept user and proxy traffic.
    Validates connectivity to critical dependencies (MongoDB Atlas, Redis).
    Returns 200 OK when ready, 503 Service Unavailable when unready.
    """
    status: str = Field(..., description="Readiness status ('ok' or 'unready')", json_schema_extra={"example": "ok"})
    service: str = Field(..., description="Service identifier", json_schema_extra={"example": "FluxChat User Service"})
    database: Optional[str] = Field(None, description="MongoDB connection state ('connected', 'disconnected', 'error')", json_schema_extra={"example": "connected"})
    redis: Optional[str] = Field(None, description="Redis connection state ('connected', 'disconnected', 'error')", json_schema_extra={"example": "connected"})
    dependencies: Optional[Dict[str, Any]] = Field(None, description="Detailed status of individual dependencies")
    error: Optional[str] = Field(None, description="Error message if readiness check failed", json_schema_extra={"example": None})
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="RFC 3339 UTC timestamp",
        json_schema_extra={"example": "2026-09-12T20:00:00.000000Z"},
    )
