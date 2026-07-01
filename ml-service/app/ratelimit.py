"""
Shared per-IP rate limiter + FastAPI dependency.

Uses an LRU-bounded OrderedDict so that hitting the IP cap evicts the *oldest*
key one at a time — never a global `.clear()`, which an attacker could use as a
counter-reset primitive. Thread-safe for FastAPI's sync threadpool.
"""

from __future__ import annotations

import threading
import time
from collections import OrderedDict, deque

from fastapi import HTTPException, Request


class RateLimiter:
    def __init__(self, max_events: int, window_s: float, max_ips: int = 20_000):
        self.max = max_events
        self.window = window_s
        self.max_ips = max_ips
        self._hits: "OrderedDict[str, deque]" = OrderedDict()
        self._lock = threading.Lock()

    def allow(self, ip: str) -> bool:
        now = time.time()
        with self._lock:
            q = self._hits.get(ip)
            if q is None:
                q = deque()
                self._hits[ip] = q
            self._hits.move_to_end(ip)
            while q and q[0] < now - self.window:
                q.popleft()
            if len(q) >= self.max:
                return False
            q.append(now)
            # bounded memory: evict the single oldest key, not everything
            while len(self._hits) > self.max_ips:
                self._hits.popitem(last=False)
            return True


def rate_limit(limiter: RateLimiter):
    """Build a FastAPI dependency that throttles by client IP."""
    def _dep(request: Request) -> None:
        ip = request.client.host if request.client else "?"
        if not limiter.allow(ip):
            raise HTTPException(429, "Too many requests. Slow down and try again shortly.")
    return _dep
