"""Traffic analytics endpoints: record a pageview, read aggregate stats."""

from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from .. import analytics
from ..ratelimit import RateLimiter

router = APIRouter(prefix="/analytics", tags=["analytics"])


class TrackIn(BaseModel):
    path: str = Field(min_length=1, max_length=256)
    session: str = Field(min_length=1, max_length=64)
    referrer: str | None = Field(default=None, max_length=256)


# Per-IP flood control. LRU-bounded (no global reset that could be abused).
_track_limiter = RateLimiter(max_events=120, window_s=60.0)


@router.post("/track")
def track(ev: TrackIn, request: Request):
    """Record one anonymous pageview. Fire-and-forget from the client."""
    ip = request.client.host if request.client else "?"
    if not _track_limiter.allow(ip):
        return {"ok": False, "throttled": True}
    analytics.record(ev.path, ev.session, ev.referrer)
    return {"ok": True}


@router.post("/analysis")
def analysis_done(request: Request, seconds: int = 0):
    """Count one on-device stroke analysis (no clip is uploaded)."""
    ip = request.client.host if request.client else "?"
    if not _track_limiter.allow(ip):
        return {"ok": False, "throttled": True}
    analytics.record_action("help", n=max(1, min(seconds, 3600)))
    return {"ok": True}


@router.get("/stats")
def stats():
    """Aggregate traffic stats for the Insights dashboard."""
    return analytics.stats()
