// The anonymous, per-browser session id used for privacy-first analytics.
// Shared by pageview tracking (Analytics.tsx) and engagement tracking so both
// key off the SAME id — no cookies, no PII, just a random UUID in localStorage.
export function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let sid = localStorage.getItem("ts_sid");
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem("ts_sid", sid);
    }
    return sid;
  } catch {
    return null;
  }
}
