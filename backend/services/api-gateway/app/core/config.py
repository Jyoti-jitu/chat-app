import os
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    SERVICE_NAME: str = "FluxChat API Gateway"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # Downstream Microservices
    AUTH_SERVICE_URL: str = "http://127.0.0.1:8001"
    USER_SERVICE_URL: str = "http://127.0.0.1:8002"
    CHAT_SERVICE_URL: str = "http://127.0.0.1:8003"
    MESSAGE_SERVICE_URL: str = "http://127.0.0.1:8004"
    WS_SERVICE_URL: str = "ws://127.0.0.1:8005"
    NOTIFICATION_SERVICE_URL: str = "http://127.0.0.1:8006"

    # Rate Limiting
    RATE_LIMIT_DEFAULT: int = 120
    RATE_LIMIT_AUTH: int = 25
    RATE_LIMIT_WINDOW_SECONDS: int = 60
    RATE_LIMIT_ENABLED: bool = True

    # HTTP Proxy
    PROXY_TIMEOUT_SECONDS: float = 30.0

    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=(
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), ".env"),
            ".env",
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
