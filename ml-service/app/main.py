"""
FastAPI entrypoint for the tennis ML & physics service.

Run (from ml-service/):
    py -m uvicorn app.main:app --reload --port 8000

Interactive API docs: http://localhost:8000/docs
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .config import ALLOWED_ORIGINS
from .routers import ball, analysis, drills, analytics

app = FastAPI(
    title="Tennis Practice ML Service",
    version=__version__,
    description="Stroke analysis (V-JEPA), pose/form comparison, and ball-flight "
                "prediction with chaos-theory sensitivity analysis.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    # No cookies/Authorization are used anywhere, so credentials stay off — this
    # also removes the wildcard-reflection risk if origins are ever widened.
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

app.include_router(ball.router)
app.include_router(analysis.router)
app.include_router(drills.router)
app.include_router(analytics.router)


@app.get("/", tags=["meta"])
def root():
    return {
        "service": "tennis-ml",
        "version": __version__,
        "endpoints": ["/predict/ball", "/analyze/upload", "/analyze/clip",
                      "/drills/catalogue", "/drills/from-flaws", "/drills/by-goal"],
        "docs": "/docs",
    }


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
