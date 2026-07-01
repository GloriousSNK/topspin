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
                        path     TEXT NOT NULL,
                        session  TEXT NOT NULL,
                        referrer TEXT
                    )"""
                )
            cur.execute("CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts)")
            conn.commit()
        finally:
            conn.close()

        # Migrate any pre-existing table that lacks the `kind` column.
        try:
            mconn = _raw_conn()
            mcur = mconn.cursor()
            if _USE_PG:
                mcur.execute("ALTER TABLE events ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'view'")
            else:
                cols = [r[1] for r in mcur.execute("PRAGMA table_info(events)").fetchall()]
                if "kind" not in cols:
                    mcur.execute("ALTER TABLE events ADD COLUMN kind TEXT NOT NULL DEFAULT 'view'")
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


def record(path: str, session: str, referrer: str | None, kind: str = "view") -> None:
    """Insert one event. `kind` is 'view' (a pageview) or 'help' (an AI analysis)."""
    p = _clean_path(path)
    s = _clip(session, MAX_SESSION, "anon")
    r = _ref_origin(referrer)
    k = "help" if kind == "help" else "view"
    with _write_lock:
        conn = _conn()
        try:
            cur = conn.cursor()
            cur.execute(
                f"INSERT INTO events (ts, kind, path, session, referrer) "
                f"VALUES ({_PH}, {_PH}, {_PH}, {_PH}, {_PH})",
                (time.time(), k, p, s, r),
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


def record_help(session: str | None = None) -> None:
    """Log one AI analysis ('a person helped'). Never raises to its caller."""
    try:
        record("/analyze", session or "anon", None, kind="help")
    except Exception:
        pass


def stats() -> dict:
    """Return aggregate stats — no per-user data leaves this function."""
    now = time.time()
    conn = _conn()
    try:
        cur = conn.cursor()
        # 'help' events = AI analyses run = people helped.
        cur.execute(f"SELECT COUNT(*) FROM events WHERE kind = {_PH}", ("help",))
        people_helped = cur.fetchone()[0]
        # 'view' events = pageviews / visitors.
        cur.execute(f"SELECT COUNT(*) FROM events WHERE kind = {_PH}", ("view",))
        total = cur.fetchone()[0]
        cur.execute(f"SELECT COUNT(DISTINCT session) FROM events WHERE kind = {_PH}", ("view",))
        unique = cur.fetchone()[0]
        cur.execute(
            f"SELECT COUNT(*) FROM events WHERE kind = {_PH} AND ts >= {_PH}",
            ("view", now - DAY),
        )
        today = cur.fetchone()[0]
        cur.execute(
            f"SELECT COUNT(DISTINCT session) FROM events WHERE kind = {_PH} AND ts >= {_PH}",
            ("view", now - DAY),
        )
        active_today = cur.fetchone()[0]

    finally:
        conn.close()

    return {
        "people_helped": int(people_helped),
        "total_views": int(total),
        "unique_visitors": int(unique),
        "views_today": int(today),
        "active_today": int(active_today),
        "generated_at": now,
    }
