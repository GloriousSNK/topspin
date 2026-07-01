"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";

/**
 * Anonymous pageview tracking. Generates a random per-browser session id once
 * (kept in localStorage), then pings the analytics endpoint on every route
 * change. No cookies, no PII — and it never blocks or breaks the page.
 */
export default function Analytics() {
  const path = usePathname();

  useEffect(() => {
    try {
      let sid = localStorage.getItem("ts_sid");
      if (!sid) {
        sid = crypto.randomUUID();
        localStorage.setItem("ts_sid", sid);
      }
      api.track(path, sid, typeof document !== "undefined" ? document.referrer : "");
    } catch {
      /* analytics must never affect the app */
    }
  }, [path]);

  return null;
}
