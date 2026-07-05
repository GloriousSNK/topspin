"""
FastAPI entrypoint for the tennis ML & physics service.

Run (from ml-service/):
    py -m uvicorn app.main:app --reload --port 8000

Interactive API docs: http://localhost:8000/docs
"""

from __future__ import annotations

import math

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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

def _json_safe(obj):
    """Recursively strip NaN/Infinity so a response can always be JSON-encoded.

    Non-standard float literals (NaN, Infinity) are accepted by Python's JSON
    parser and can reach us as real floats. Starlette's strict encoder then
    raises while *rendering the error response*, turning a would-be clean 422
    into a bare 500. Scrubbing the payload here keeps every error a proper 4xx.
    """
    if isinstance(obj, float):
        return obj if math.isfinite(obj) else None
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_json_safe(v) for v in obj]
    return obj


@app.exception_handler(RequestValidationError)
async def _validation_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"detail": _json_safe(jsonable_encoder(exc.errors()))})


@app.exception_handler(Exception)
async def _unhandled_handler(request: Request, exc: Exception):
    # Never leak internals or a bare text/plain 500 to the client.
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


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
