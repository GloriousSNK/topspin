"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { getSessionId } from "@/lib/analyticsSession";
import { onIdle } from "@/lib/idle";

/**
 * Anonymous pageview tracking. Generates a random per-browser session id once
 * (kept in localStorage), then pings the analytics endpoint on every route
 * change. No cookies, no PII — and it never blocks or breaks the page.
 */
export default function Analytics() {
  const path = usePathname();

  useEffect(() => {
    if (path.startsWith("/consent") || path.startsWith("/auth")) return;
    // Off the critical path: the ping waits for an idle moment after navigation.
    // keepalive on the request means it still goes out if the tab closes first.
    return onIdle(() => {
      try {
        const sid = getSessionId();
        if (sid) api.track(path, sid, typeof document !== "undefined" ? document.referrer : "");
      } catch {
        /* analytics must never affect the app */
      }
    }, 3000);
  }, [path]);

  return null;
}
