// Small in-memory, per-key sliding-window rate limiter for the consent route
// handlers (login/consent brute-force mitigation — the "TODO 1b" checklist in
// docs/coach-layer-threat-model.md).
//
// Honest caveat: on serverless (Vercel) this is PER INSTANCE and resets on cold
// start, so it's a best-effort speed bump, not a hard guarantee — it blunts a
// naive flood from one source but isn't a distributed limiter. The heavy DB
// mutations (approval, consent flips) are additionally protected by single-use
// tokens and RLS, which don't depend on this. Mirrors the backend's LRU-bounded
// approach (ml-service/app/ratelimit.py) so memory can't grow without bound.

interface Bucket {
  hits: number[];
}

const MAX_KEYS = 20_000;
const buckets = new Map<string, Bucket>();

// Returns true if this event is allowed, false if the key is over the limit.
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { hits: [] };
    buckets.set(key, b);
  } else {
    // refresh LRU position
    buckets.delete(key);
    buckets.set(key, b);
  }
  b.hits = b.hits.filter((t) => t > now - windowMs);
  if (b.hits.length >= max) return false;
  b.hits.push(now);
  // bounded memory: evict the single oldest key, never a global clear
  while (buckets.size > MAX_KEYS) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
  return true;
}

// Best-effort client IP from the standard proxy headers Vercel/Next set.
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
