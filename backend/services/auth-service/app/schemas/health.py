from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(default="ok", description="Service operational status")
    service: str = Field(..., description="Name of the running microservice")
    version: str = Field(default="1.0.0", description="Microservice API version")
    environment: str = Field(..., description="Running environment (development/production)")


class RootResponse(BaseModel):
    message: str = Field(..., description="Welcome message")
    service: str = Field(..., description="Service name")
    docs_url: str = Field(..., description="Interactive OpenAPI documentation URL")
    health_url: str = Field(..., description="Health check endpoint URL")
