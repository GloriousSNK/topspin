"""
Privacy-first traffic analytics with a pluggable store.

No third-party trackers, no cookies, no PII — just an anonymous per-browser
session id and the path that was viewed.

Storage backend is chosen automatically:
  * If DATABASE_URL is set  -> Postgres (persistent; use this in production, e.g.
    a free Neon database, so counts survive restarts/redeploys).
  * Otherwise               -> local SQLite file (great for local dev).

All writes are sanitised, length-capped and parameterised (no SQL injection),
and the store self-prunes so it can't grow without bound.
"""

from __future__ import annotations

import os
import random
import threading
import time
from pathlib import Path
from urllib.parse import urlsplit

from .config import STORAGE_DIR

DATABASE_URL = os.getenv("DATABASE_URL")
_USE_PG = bool(DATABASE_URL)
_PH = "%s" if _USE_PG else "?"          # parameter placeholder per driver

DB_PATH = Path(STORAGE_DIR) / "analytics.db"

MAX_PATH = 256
MAX_SESSION = 64
MAX_REF = 256
MAX_ROWS = 200_000          # hard cap; oldest rows pruned beyond this
DAY = 86_400

_write_lock = threading.Lock()
_init_lock = threading.Lock()
_initialised = False


def _raw_conn():
    if _USE_PG:
        import psycopg  # lazy: only needed in Postgres mode
        return psycopg.connect(DATABASE_URL)
    import sqlite3
    c = sqlite3.connect(DB_PATH, timeout=5)
    c.execute("PRAGMA busy_timeout=5000")
    return c


def _ensure_schema() -> None:
    global _initialised
    if _initialised:
        return
    with _init_lock:
        if _initialised:
            return
        conn = _raw_conn()
        try:
            cur = conn.cursor()
            if _USE_PG:
                cur.execute(
                    """CREATE TABLE IF NOT EXISTS events (
                        id       BIGSERIAL PRIMARY KEY,
                        ts       DOUBLE PRECISION NOT NULL,
                        path     TEXT NOT NULL,
                        session  TEXT NOT NULL,
                        referrer TEXT
                    )"""
                )
            else:
                cur.execute("PRAGMA journal_mode=WAL")
                cur.execute(
                    """CREATE TABLE IF NOT EXISTS events (
                        id       INTEGER PRIMARY KEY AUTOINCREMENT,
                        ts       REAL NOT NULL,
                        path     TEXT NOT NULL,
                        session  TEXT NOT NULL,
                        referrer TEXT
                    )"""
                )
            cur.execute("CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts)")
            conn.commit()
        finally:
            conn.close()
        _initialised = True


def _conn():
    _ensure_schema()
    return _raw_conn()


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
    with _write_lock:
        conn = _conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"INSERT INTO events (ts, path, session, referrer) "
                f"VALUES ({_PH}, {_PH}, {_PH}, {_PH})",
                (time.time(), p, s, r),
            )
            # Prune occasionally — the COUNT(*) scan is O(n); don't run it every write.
            if random.random() < 0.02:
                cur.execute("SELECT COUNT(*) FROM events")
                n = cur.fetchone()[0]
                if n > MAX_ROWS:
                    cur.execute(
                        f"DELETE FROM events WHERE id IN "
                        f"(SELECT id FROM events ORDER BY id ASC LIMIT {_PH})",
                        (n - MAX_ROWS,),
                    )
            conn.commit()
        finally:
            conn.close()


def stats() -> dict:
    """Return aggregate traffic stats — no per-user data leaves this function."""
    now = time.time()
    conn = _conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM events")
        total = cur.fetchone()[0]
        cur.execute("SELECT COUNT(DISTINCT session) FROM events")
        unique = cur.fetchone()[0]
        cur.execute(f"SELECT COUNT(*) FROM events WHERE ts >= {_PH}", (now - DAY,))
        today = cur.fetchone()[0]
        cur.execute(f"SELECT COUNT(DISTINCT session) FROM events WHERE ts >= {_PH}", (now - DAY,))
        active_today = cur.fetchone()[0]

        cur.execute(
            "SELECT path, COUNT(*) AS v FROM events GROUP BY path ORDER BY v DESC LIMIT 12"
        )
        per_page = [{"path": row[0], "views": row[1]} for row in cur.fetchall()]

        # Last 7 days, bucketed by local day (done in Python — backend-agnostic).
        cur.execute(f"SELECT ts FROM events WHERE ts >= {_PH}", (now - 7 * DAY,))
        rows = cur.fetchall()
        buckets: dict[str, int] = {}
        for i in range(7):
            day = time.strftime("%Y-%m-%d", time.localtime(now - (6 - i) * DAY))
            buckets[day] = 0
        for (ts,) in rows:
            day = time.strftime("%Y-%m-%d", time.localtime(ts))
            if day in buckets:
                buckets[day] += 1
        daily = [{"date": d, "views": v} for d, v in buckets.items()]

        cur.execute("SELECT path, ts FROM events ORDER BY id DESC LIMIT 15")
        recent = [{"path": row[0], "ts": row[1]} for row in cur.fetchall()]
    finally:
        conn.close()

    return {
        "total_views": int(total),
        "unique_visitors": int(unique),
        "views_today": int(today),
        "active_today": int(active_today),
        "per_page": per_page,
        "daily": daily,
        "recent": recent,
        "generated_at": now,
    }
