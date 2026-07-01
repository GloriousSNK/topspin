"""Service configuration."""

from __future__ import annotations

import os
from pathlib import Path

# Where uploaded clips are stored (kept out of git).
STORAGE_DIR = Path(os.getenv("TENNIS_STORAGE_DIR", Path(__file__).resolve().parent.parent / "storage"))
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

# CORS: the Next.js dev server. Strip whitespace and never allow a bare "*"
# (a wildcard origin combined with credentials would be a cross-origin hole).
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "TENNIS_ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if o.strip() and o.strip() != "*"
]

MAX_UPLOAD_MB = int(os.getenv("TENNIS_MAX_UPLOAD_MB", "100"))

# Cap how many clips can pile up in storage; oldest are reaped past this so a
# flood of uploads can't fill the disk.
MAX_STORED_CLIPS = int(os.getenv("TENNIS_MAX_STORED_CLIPS", "200"))
