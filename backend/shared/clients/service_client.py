"""
Resilient Inter-Service HTTP Client (Phase 20 Standardized Service Communication).
Uses httpx.AsyncClient with connection pooling, retries, and automatic error translation.
"""
import asyncio
import os
import uuid
from typing import Any, Dict, Optional
import httpx

from shared.errors.exceptions import (
    AppException,
    AuthenticationError,
    AuthorizationError,
    BadGatewayError,
    ConflictError,
    NotFoundError,
    RateLimitError,
    ServiceUnavailableError,
    ValidationError,
)
from shared.loggers.structured_logger import get_logger


logger = get_logger("Shared.ServiceClient")


class ServiceClient:
    """
    HTTP client for synchronous microservice-to-microservice communication.
    """

    def __init__(
        self,
        base_url: str,
        target_service: str,
        timeout: float = 10.0,
        max_retries: int = 2,
    ):
        self.base_url = base_url.rstrip("/")
        self.target_service = target_service
        self.timeout = timeout
        self.max_retries = max_retries
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=httpx.Timeout(self.timeout, connect=3.0),
                limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
            )
        return self._client

    async def close(self) -> None:
        """Closes the underlying HTTP client session."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    def _translate_error(self, resp: httpx.Response, request_id: str) -> None:
        """Translates HTTP error responses into domain AppException classes."""
        try:
            body = resp.json()
            error_data = body.get("error", {})
            msg = error_data.get("message") or body.get("detail") or resp.text
            details = error_data.get("details")
        except Exception:
            msg = resp.text or f"HTTP {resp.status_code} from {self.target_service}"
            details = None

        status = resp.status_code
        if status == 401:
            raise AuthenticationError(message=msg, details=details)
        elif status == 403:
            raise AuthorizationError(message=msg, details=details)
        elif status == 404:
            raise NotFoundError(message=msg, details=details)
        elif status == 409:
            raise ConflictError(message=msg, details=details)
        elif status == 422:
            raise ValidationError(message=msg, details=details)
        elif status == 429:
            retry_after = int(resp.headers.get("retry-after", "60"))
            raise RateLimitError(message=msg, retry_after=retry_after)
        elif status in (502, 504):
            raise BadGatewayError(message=f"Gateway error from {self.target_service}: {msg}")
        elif status == 503:
            raise ServiceUnavailableError(message=f"{self.target_service} is unavailable: {msg}")
        else:
            raise AppException(message=msg, status_code=status, details=details)

    async def request(
        self,
        method: str,
        path: str,
        headers: Optional[Dict[str, str]] = None,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Any] = None,
        request_id: Optional[str] = None,
    ) -> httpx.Response:
        """Executes HTTP request with exponential backoff retries on network failures."""
        client = self._get_client()
        req_id = request_id or f"req_{uuid.uuid4().hex[:12]}"

        req_headers = dict(headers or {})
        req_headers["x-request-id"] = req_id

        attempt = 0
        backoff = 0.2
        last_exception: Optional[Exception] = None

        while attempt <= self.max_retries:
            try:
                resp = await client.request(
                    method=method,
                    url=path,
                    headers=req_headers,
                    params=params,
                    json=json_data,
                )

                if resp.status_code >= 400:
                    self._translate_error(resp, req_id)

                return resp

            except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
                last_exception = exc
                attempt += 1
                if attempt > self.max_retries:
                    break
                logger.warning(
                    f"Retry {attempt}/{self.max_retries} connecting to {self.target_service} at {path} after {backoff}s"
                )
                await asyncio.sleep(backoff)
                backoff *= 2

        logger.error(f"Failed to communicate with {self.target_service} after {self.max_retries} retries: {last_exception}")
        raise BadGatewayError(
            message=f"Unable to reach {self.target_service} at {self.base_url}{path}: {last_exception}"
        )

    async def get(self, path: str, **kwargs) -> httpx.Response:
        return await self.request("GET", path, **kwargs)

    async def post(self, path: str, json_data: Optional[Any] = None, **kwargs) -> httpx.Response:
        return await self.request("POST", path, json_data=json_data, **kwargs)

    async def patch(self, path: str, json_data: Optional[Any] = None, **kwargs) -> httpx.Response:
        return await self.request("PATCH", path, json_data=json_data, **kwargs)

    async def put(self, path: str, json_data: Optional[Any] = None, **kwargs) -> httpx.Response:
        return await self.request("PUT", path, json_data=json_data, **kwargs)

    async def delete(self, path: str, **kwargs) -> httpx.Response:
        return await self.request("DELETE", path, **kwargs)


# Factory helpers
def get_auth_client() -> ServiceClient:
    url = os.getenv("AUTH_SERVICE_URL", "http://127.0.0.1:8001")
    return ServiceClient(url, target_service="auth-service")


def get_user_client() -> ServiceClient:
    url = os.getenv("USER_SERVICE_URL", "http://127.0.0.1:8002")
    return ServiceClient(url, target_service="user-service")


def get_chat_client() -> ServiceClient:
    url = os.getenv("CHAT_SERVICE_URL", "http://127.0.0.1:8003")
    return ServiceClient(url, target_service="chat-service")


def get_message_client() -> ServiceClient:
    url = os.getenv("MESSAGE_SERVICE_URL", "http://127.0.0.1:8004")
    return ServiceClient(url, target_service="message-service")


def get_notification_client() -> ServiceClient:
    url = os.getenv("NOTIFICATION_SERVICE_URL", "http://127.0.0.1:8006")
    return ServiceClient(url, target_service="notification-service")
