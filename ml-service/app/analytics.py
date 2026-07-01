"""
Privacy-first, self-hosted traffic analytics.

No third-party trackers, no cookies, no PII — just an anonymous per-browser
session id and the path that was viewed, kept in a local SQLite file. Fits the
app's "runs on your machine, nothing uploaded" promise.

All writes are length-capped and parameterised (no SQL injection surface), and
the store self-prunes so it can't grow without bound.
"""

from __future__ import annotations

import random
import sqlite3
import threading
import time
from pathlib import Path
from urllib.parse import urlsplit

from .config import STORAGE_DIR

DB_PATH = Path(STORAGE_DIR) / "analytics.db"

MAX_PATH = 256
MAX_SESSION = 64
MAX_REF = 256
MAX_ROWS = 200_000          # hard cap; oldest rows pruned beyond this
DAY = 86_400

# Serialise writes (WAL allows many readers but only one writer) and run schema
# setup once, not on every connection.
_write_lock = threading.Lock()
_init_lock = threading.Lock()
_initialised = False


def _ensure_schema() -> None:
    global _initialised
    if _initialised:
        return
    with _init_lock:
        if _initialised:
            return
        c = sqlite3.connect(DB_PATH, timeout=5)
        try:
            c.execute("PRAGMA journal_mode=WAL")
            c.execute(
                """CREATE TABLE IF NOT EXISTS events (
                    id       INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts       REAL NOT NULL,
                    path     TEXT NOT NULL,
                    session  TEXT NOT NULL,
                    referrer TEXT
                )"""
            )
            c.execute("CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts)")
            c.commit()
        finally:
            c.close()
        _initialised = True


def _conn() -> sqlite3.Connection:
    _ensure_schema()
    c = sqlite3.connect(DB_PATH, timeout=5)
    c.execute("PRAGMA busy_timeout=5000")
    return c


def _clip(value: str | None, n: int, default: str = "") -> str:
    if not value:
        return default
    return str(value)[:n]


def _clean_path(p: str | None) -> str:
    """Keep just the path — drop any query string / fragment (could hold secrets)."""
    if not p:
        return "/"
    s = str(p)
    for sep in ("?", "#"):
        i = s.find(sep)
        if i != -1:
            s = s[:i]
    return s[:MAX_PATH] or "/"


def _ref_origin(url: str | None) -> str:
    """Store only the referrer's origin (scheme://host) — never its path/query."""
    if not url:
        return ""
    try:
        s = urlsplit(str(url))
        if s.scheme and s.netloc:
            return f"{s.scheme}://{s.netloc}"[:MAX_REF]
    except ValueError:
        pass
    return ""


def record(path: str, session: str, referrer: str | None) -> None:
    """Insert one pageview. Inputs are sanitised and length-capped."""
    p = _clean_path(path)
    s = _clip(session, MAX_SESSION, "anon")
    r = _ref_origin(referrer)
    # Single writer at a time; WAL allows readers to keep going meanwhile.
    with _write_lock:
        c = _conn()
        try:
            c.execute(
                "INSERT INTO events (ts, path, session, referrer) VALUES (?, ?, ?, ?)",
                (time.time(), p, s, r),
            )
            # Prune only occasionally — the COUNT(*) scan is O(n), so don't run
            # it on every insert (that would amplify write-lock contention).
            if random.random() < 0.02:
                n = c.execute("SELECT COUNT(*) FROM events").fetchone()[0]
                if n > MAX_ROWS:
                    c.execute(
                        "DELETE FROM events WHERE id IN "
                        "(SELECT id FROM events ORDER BY id ASC LIMIT ?)",
                        (n - MAX_ROWS,),
                    )
            c.commit()
        finally:
            c.close()


def stats() -> dict:
    """Return aggregate traffic stats — no per-user data leaves this function."""
    now = time.time()
    c = _conn()
    try:
        total = c.execute("SELECT COUNT(*) FROM events").fetchone()[0]
        unique = c.execute("SELECT COUNT(DISTINCT session) FROM events").fetchone()[0]
        today = c.execute(
            "SELECT COUNT(*) FROM events WHERE ts >= ?", (now - DAY,)
        ).fetchone()[0]
        active_today = c.execute(
            "SELECT COUNT(DISTINCT session) FROM events WHERE ts >= ?", (now - DAY,)
        ).fetchone()[0]

        per_page = [
            {"path": row[0], "views": row[1]}
            for row in c.execute(
                "SELECT path, COUNT(*) AS v FROM events GROUP BY path ORDER BY v DESC LIMIT 12"
            )
        ]

        # Last 7 days, bucketed by local day.
        since = now - 7 * DAY
        rows = c.execute("SELECT ts FROM events WHERE ts >= ?", (since,)).fetchall()
        buckets: dict[str, int] = {}
        for i in range(7):
            day = time.strftime("%Y-%m-%d", time.localtime(now - (6 - i) * DAY))
            buckets[day] = 0
        for (ts,) in rows:
            day = time.strftime("%Y-%m-%d", time.localtime(ts))
            if day in buckets:
                buckets[day] += 1
        daily = [{"date": d, "views": v} for d, v in buckets.items()]

        recent = [
            {"path": row[0], "ts": row[1]}
            for row in c.execute(
                "SELECT path, ts FROM events ORDER BY id DESC LIMIT 15"
            )
        ]
    finally:
        c.close()

    return {
        "total_views": total,
        "unique_visitors": unique,
        "views_today": today,
        "active_today": active_today,
        "per_page": per_page,
        "daily": daily,
        "recent": recent,
        "generated_at": now,
    }
