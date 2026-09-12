"""
Sliding-window rate limiter for FluxChat API Gateway.
"""
import time
from collections import defaultdict
from typing import Dict, List, Tuple
from app.core.config import settings


class SlidingWindowRateLimiter:
    """
    Sliding window in-memory rate limiter.
    Stores timestamps of requests per client key within the active time window.
    """

    def __init__(self, window_seconds: int = 60):
        self.window_seconds = window_seconds
        # key -> list of float timestamps
        self.requests: Dict[str, List[float]] = defaultdict(list)
        self.last_cleanup = time.time()

    def _cleanup(self, now: float) -> None:
        """Evicts expired keys to prevent memory leak."""
        if now - self.last_cleanup < 60:
            return
        self.last_cleanup = now
        cutoff = now - self.window_seconds
        empty_keys = []
        for key, timestamps in self.requests.items():
            valid_ts = [ts for ts in timestamps if ts > cutoff]
            if not valid_ts:
                empty_keys.append(key)
            else:
                self.requests[key] = valid_ts
        for k in empty_keys:
            del self.requests[k]

    def check(self, key: str, limit: int) -> Tuple[bool, int, int, int]:
        """
        Checks if the request is permitted under rate limit.

        Returns:
            (allowed, limit, remaining, reset_time_seconds)
        """
        now = time.time()
        self._cleanup(now)

        cutoff = now - self.window_seconds
        history = [ts for ts in self.requests[key] if ts > cutoff]
        self.requests[key] = history

        current_count = len(history)
        remaining = max(0, limit - current_count)
        oldest = history[0] if history else now
        reset_seconds = int(max(1, (oldest + self.window_seconds) - now))

        if current_count >= limit:
            return False, limit, 0, reset_seconds

        self.requests[key].append(now)
        return True, limit, remaining - 1, reset_seconds


rate_limiter = SlidingWindowRateLimiter(window_seconds=settings.RATE_LIMIT_WINDOW_SECONDS)
