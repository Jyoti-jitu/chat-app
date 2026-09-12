from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import logger
from app.api.v1.router import api_router
from app.schemas.health import HealthResponse, RootResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        f"Starting {settings.APP_NAME} in [{settings.APP_ENV}] mode on {settings.HOST}:{settings.PORT}..."
    )
    yield
    logger.info(f"Shutting down {settings.APP_NAME}...")


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Production-ready authentication & identity microservice for FluxChat.",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get(
    "/",
    response_model=RootResponse,
    tags=["Root"],
    summary="Root Service Endpoint",
)
async def root() -> RootResponse:
    return RootResponse(
        message=f"Welcome to {settings.APP_NAME}",
        service=settings.APP_NAME,
        docs_url="/docs",
        health_url="/health",
    )


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Health"],
    summary="Root Health Check",
)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service=settings.APP_NAME,
        version="1.0.0",
        environment=settings.APP_ENV,
    )


# Mount versioned API routes
app.include_router(api_router, prefix=settings.API_V1_STR, tags=["V1"])
