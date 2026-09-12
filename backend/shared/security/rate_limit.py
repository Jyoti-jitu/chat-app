"""
Redis-backed Rate Limiting dependency for FastAPI endpoints (Phase 23).
Provides defense-in-depth protection against brute-force attacks and abuse.
"""
from typing import Callable
from fastapi import HTTPException, Request, status
from shared.redis.client import redis_manager


def require_rate_limit(key_prefix: str, limit: int, window_seconds: int) -> Callable:
    """
    FastAPI dependency enforcing rate limits via Redis counters with expiration.

    Args:
        key_prefix: Unique namespace for the rate-limited route (e.g. 'auth:login')
        limit: Maximum allowed requests within the time window
        window_seconds: Window duration in seconds
    """
    async def dependency(request: Request) -> None:
        client_ip = request.client.host if request.client else "127.0.0.1"
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()

        redis = redis_manager.client
        key = f"rl:{key_prefix}:{client_ip}"

        try:
            current = await redis.incr(key)
            if current == 1:
                await redis.expire(key, window_seconds)

            if current > limit:
                ttl = await redis.ttl(key)
                retry_after = max(1, ttl if ttl > 0 else window_seconds)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded for {key_prefix}. Try again in {retry_after} seconds.",
                    headers={"Retry-After": str(retry_after)},
                )
        except HTTPException:
            raise
        except Exception:
            # On unexpected Redis failure, fail open to avoid blocking legitimate traffic
            pass

    return dependency
