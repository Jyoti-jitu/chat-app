"""
Configuration settings for FluxChat User Service.
Loads dynamically from environment variables or .env file using Pydantic Settings.
"""
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application runtime settings for User Service."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "FluxChat User Service"
    APP_ENV: str = "development"
    DEBUG: bool = True
    PORT: int = 8002
    HOST: str = "0.0.0.0"

    # MongoDB Atlas Database Configuration (Shared with Auth Service)
    MONGODB_URL: str = "mongodb+srv://parhijyotiswarup_db_user:JxHPTM5oQxjg9qJ9@chat.njrcbvy.mongodb.net/?appName=Chat"
    MONGODB_DATABASE: str = "fluxchat_db"

    # JWT Authentication Configuration
    JWT_SECRET: str = "fluxchat-production-jwt-secret-key-32-chars-long-secure"
    JWT_ALGORITHM: str = "HS256"

    # CORS Allowed Origins
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    LOG_LEVEL: str = "INFO"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)


settings = Settings()
