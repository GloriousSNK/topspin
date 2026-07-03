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
                        kind     TEXT NOT NULL DEFAULT 'view',
                        n        BIGINT NOT NULL DEFAULT 1,
                        secs     BIGINT NOT NULL DEFAULT 0,
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
                        kind     TEXT NOT NULL DEFAULT 'view',
                        n        INTEGER NOT NULL DEFAULT 1,
                        secs     INTEGER NOT NULL DEFAULT 0,
                        path     TEXT NOT NULL,
                        session  TEXT NOT NULL,
                        referrer TEXT
                    )"""
                )
            cur.execute("CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts)")
            conn.commit()
        finally:
            conn.close()

        # Migrate pre-existing tables that lack the newer columns.
        for col, ddl_pg, ddl_sqlite in (
            ("kind", "TEXT NOT NULL DEFAULT 'view'", "TEXT NOT NULL DEFAULT 'view'"),
            ("n", "BIGINT NOT NULL DEFAULT 1", "INTEGER NOT NULL DEFAULT 1"),
            ("secs", "BIGINT NOT NULL DEFAULT 0", "INTEGER NOT NULL DEFAULT 0"),
        ):
            try:
                mconn = _raw_conn()
                mcur = mconn.cursor()
                if _USE_PG:
                    mcur.execute(f"ALTER TABLE events ADD COLUMN IF NOT EXISTS {col} {ddl_pg}")
                else:
                    cols = [r[1] for r in mcur.execute("PRAGMA table_info(events)").fetchall()]
                    if col not in cols:
                        mcur.execute(f"ALTER TABLE events ADD COLUMN {col} {ddl_sqlite}")
                mconn.commit()
                mconn.close()
            except Exception:
                pass

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


# 'view' = pageview; the rest are the useful actions that count toward "helped".
_KINDS = {"view", "help", "sim", "workout"}


def record(path: str, session: str, referrer: str | None, kind: str = "view", n: int = 1, secs: int = 0) -> None:
    """Insert one event. `n` is the work magnitude, `secs` any duration in seconds."""
    p = _clean_path(path)
    s = _clip(session, MAX_SESSION, "anon")
    r = _ref_origin(referrer)
    k = kind if kind in _KINDS else "view"
    nn = max(1, min(int(n or 1), 10_000_000))
    ss = max(0, min(int(secs or 0), 86_400))
    with _write_lock:
        conn = _conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"INSERT INTO events (ts, kind, n, secs, path, session, referrer) "
                f"VALUES ({_PH}, {_PH}, {_PH}, {_PH}, {_PH}, {_PH}, {_PH})",
                (time.time(), k, nn, ss, p, s, r),
            )
            # Prune occasionally — the COUNT(*) scan is O(n); don't run it every write.
            if random.random() < 0.02:
                cur.execute("SELECT COUNT(*) FROM events")
                cnt = cur.fetchone()[0]
                if cnt > MAX_ROWS:
                    cur.execute(
                        f"DELETE FROM events WHERE id IN "
                        f"(SELECT id FROM events ORDER BY id ASC LIMIT {_PH})",
                        (cnt - MAX_ROWS,),
                    )
            conn.commit()
        finally:
            conn.close()


def record_action(kind: str, n: int = 1, secs: int = 0, session: str | None = None) -> None:
    """Log one useful action (analysis/simulation/workout). Never raises."""
    try:
        record(f"/{kind}", session or "anon", None, kind=kind, n=n, secs=secs)
    except Exception:
        pass


def stats() -> dict:
    """Aggregate, honest counts summed from the event log."""
    now = time.time()
    conn = _conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT
                SUM(CASE WHEN kind = 'help' THEN 1 ELSE 0 END),
                SUM(CASE WHEN kind = 'workout' THEN 1 ELSE 0 END),
                SUM(CASE WHEN kind = 'sim' THEN n ELSE 0 END),
                SUM(CASE WHEN kind = 'help' THEN n ELSE 0 END),
                SUM(CASE WHEN kind = 'help' THEN secs ELSE 0 END),
                COUNT(DISTINCT session),
                COUNT(DISTINCT CASE WHEN referrer <> '' THEN referrer END)
            FROM events"""
        )
        r = [int(x or 0) for x in (cur.fetchone() or [0] * 7)]
    finally:
        conn.close()

    videos, sessions, sims, frames, footage_seconds, athletes, orgs = r
    return {
        "videos_analyzed": videos,
        "practice_sessions": sessions,
        "simulations": sims,
        "frames_processed": frames,          # real total frames (fps x duration)
        "footage_seconds": footage_seconds,
        "athletes_served": athletes,
        "orgs_reached": orgs,
        "generated_at": now,
    }
