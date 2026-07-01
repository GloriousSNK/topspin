"""Clip upload + JEPA/pose analysis endpoints."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request, Depends

from ..config import STORAGE_DIR, MAX_UPLOAD_MB, MAX_STORED_CLIPS
from ..schemas import AnalyzeRequest
from ..core import jepa, pose_analysis
from ..ratelimit import RateLimiter, rate_limit
from .. import analytics

router = APIRouter(prefix="/analyze", tags=["analysis"])

ALLOWED_EXT = {".mp4", ".mov", ".webm", ".avi", ".mkv"}
MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024
CHUNK = 1 << 20

# Uploads are expensive (disk + I/O); analyze is cheap (stub). Separate limits.
_upload_limiter = RateLimiter(max_events=20, window_s=60.0)
_clip_limit = Depends(rate_limit(RateLimiter(max_events=120, window_s=60.0)))


def _sniff_video(header: bytes) -> bool:
    """
    Validate the actual container by magic bytes — don't trust the extension.
    Covers the allowed formats: MP4/MOV (ISO-BMFF 'ftyp'), WebM/MKV (EBML),
    AVI (RIFF....AVI ).
    """
    if len(header) < 12:
        return False
    if header[4:8] == b"ftyp":                       # mp4 / mov
        return True
    if header[:4] == b"\x1a\x45\xdf\xa3":            # webm / mkv (EBML)
        return True
    if header[:4] == b"RIFF" and header[8:12] == b"AVI ":  # avi
        return True
    return False


def _enforce_storage_cap() -> None:
    """Keep at most MAX_STORED_CLIPS files; reap the oldest beyond that."""
    files = sorted(
        (p for p in STORAGE_DIR.iterdir() if p.is_file() and p.suffix.lower() in ALLOWED_EXT),
        key=lambda p: p.stat().st_mtime,
    )
    excess = len(files) - (MAX_STORED_CLIPS - 1)
    for p in files[:max(0, excess)]:
        p.unlink(missing_ok=True)


@router.post("/upload")
async def upload_clip(
    request: Request,
    file: UploadFile = File(...),
    stroke: str | None = Form(None),
):
    """
    Accept a video clip, store it, and return a clip_id. Analysis is a separate
    call so the UI can show upload progress, then trigger analysis.
    """
    ip = request.client.host if request.client else "?"
    if not _upload_limiter.allow(ip):
        raise HTTPException(429, "Too many uploads. Slow down and try again shortly.")

    ext = Path(file.filename or "clip.mp4").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"Unsupported format {ext}. Use one of {sorted(ALLOWED_EXT)}.")

    # Cheap pre-filter: reject before reading a single byte if the client
    # declares an oversized body (the streamed counter below is authoritative).
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_BYTES + CHUNK:
        raise HTTPException(413, f"File exceeds {MAX_UPLOAD_MB} MB limit.")

    _enforce_storage_cap()

    clip_id = uuid.uuid4().hex[:12]
    stroke_hint = (stroke or "")[:32] or None
    dest = STORAGE_DIR / f"{clip_id}{ext}"

    size = 0
    first = True
    try:
        with dest.open("wb") as out:
            while chunk := await file.read(CHUNK):
                if first:
                    if not _sniff_video(chunk[:16]):
                        raise HTTPException(415, "File is not a recognised video (content check failed).")
                    first = False
                if size + len(chunk) > MAX_BYTES:
                    raise HTTPException(413, f"File exceeds {MAX_UPLOAD_MB} MB limit.")
                out.write(chunk)
                size += len(chunk)
    except HTTPException:
        dest.unlink(missing_ok=True)
        raise
    except Exception:
        dest.unlink(missing_ok=True)
        raise HTTPException(500, "Upload failed.")

    if first or size == 0:
        dest.unlink(missing_ok=True)
        raise HTTPException(400, "Empty file.")

    # Count this as one "person helped" (a clip submitted for AI analysis).
    analytics.record_help(session=clip_id)

    return {
        "clip_id": clip_id,
        # echo only the basename, capped — never the raw client-supplied path
        "filename": Path(file.filename or "clip").name[:128],
        "size_bytes": size,
        "stroke_hint": stroke_hint,
        "stored": True,
    }


@router.post("/clip", dependencies=[_clip_limit])
def analyze_clip(req: AnalyzeRequest):
    """
    Run the (stubbed) V-JEPA stroke analysis + pose/form comparison for a clip.
    Returns flaws, phase segmentation, and per-joint form feedback.
    """
    stroke_analysis = jepa.analyze_clip(
        clip_id=req.clip_id,
        duration_s=req.duration_s,
        declared_stroke=req.stroke,
    )
    pose = pose_analysis.analyze_form(req.clip_id, stroke=stroke_analysis.stroke)

    return {
        "clip_id": req.clip_id,
        "analysis": stroke_analysis.to_dict(),
        "pose": pose.to_dict(),
    }
