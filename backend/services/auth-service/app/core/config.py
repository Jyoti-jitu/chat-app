from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    APP_NAME: str = "FluxChat Auth Service"
    APP_ENV: str = "development"
    DEBUG: bool = True
    PORT: int = 8001
    HOST: str = "0.0.0.0"
    API_V1_STR: str = "/api/v1"

    # Database Configuration (Phase 2)
    MONGODB_URL: str = "mongodb+srv://parhijyotiswarup_db_user:JxHPTM5oQxjg9qJ9@chat.njrcbvy.mongodb.net/?appName=Chat"
    MONGODB_DATABASE: str = "fluxchat_db"

    # JWT Authentication Configuration (Phase 3)
    JWT_SECRET: str = "fluxchat-production-jwt-secret-key-32-chars-long-secure"
    JWT_ALGORITHM: str = "HS256"
    # Access and refresh tokens persist indefinitely until explicit logout (10 years)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 5256000
    REFRESH_TOKEN_EXPIRE_DAYS: int = 3650

    # 2Factor SMS OTP Configuration
    TWO_FACTOR_API_KEY: str = ""
    TWO_FACTOR_BASE_URL: str = "https://2factor.in/API/V1"
    TWO_FACTOR_OTP_TEMPLATE: str = ""
    OTP_EXPIRE_MINUTES: int = 10
    OTP_RESEND_COOLDOWN_SECONDS: int = 30
    OTP_MAX_ATTEMPTS: int = 5

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

