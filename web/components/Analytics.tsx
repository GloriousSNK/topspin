"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { getSessionId } from "@/lib/analyticsSession";

/**
 * Anonymous pageview tracking. Generates a random per-browser session id once
 * (kept in localStorage), then pings the analytics endpoint on every route
 * change. No cookies, no PII — and it never blocks or breaks the page.
 */
export default function Analytics() {
  const path = usePathname();

  useEffect(() => {
    if (path.startsWith("/consent") || path.startsWith("/auth")) return;
    try {
      const sid = getSessionId();
      if (sid) api.track(path, sid, typeof document !== "undefined" ? document.referrer : "");
    } catch {
      /* analytics must never affect the app */
    }
  }, [path]);

  return null;
}
