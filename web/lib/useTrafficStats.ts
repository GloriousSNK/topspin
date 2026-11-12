"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import type { TrafficStats } from "./types";

/*
 * One live read of the self-hosted analytics, shared by every consumer.
 *
 * The landing marquee, the landing count-up band and the Insights dashboard all
 * call this. They share a single module-level cache and a single 15s refresh
 * loop, so they always render the *same* numbers — the count of videos analysed
 * on the landing can never drift from the one on Insights.
 */

let cache: TrafficStats | null = null;
const subscribers = new Set<(s: TrafficStats | null) => void>();
let timer: ReturnType<typeof setInterval> | null = null;

// Shallow compare of the numeric fields: the 15s poll usually returns the same
// figures, and handing every subscriber a fresh object each time would re-render
// the landing marquee, count-up band and Insights for nothing. `generated_at`
// is ignored: it changes on every response and nothing renders it.
function sameStats(a: TrafficStats | null, b: TrafficStats): boolean {
  if (!a) return false;
  const keys = (Object.keys(b) as (keyof TrafficStats)[]).filter((k) => k !== "generated_at");
  return keys.length === Object.keys(a).filter((k) => k !== "generated_at").length
    && keys.every((k) => Object.is(a[k], b[k]));
}

async function refresh(): Promise<void> {
  try {
    const next = await api.stats();
    if (sameStats(cache, next)) return;
    cache = next;
    for (const fn of subscribers) fn(cache);
  } catch {
    /* keep the last good value on a transient blip */
  }
}

export function useTrafficStats(): TrafficStats | null {
  const [stats, setStats] = useState<TrafficStats | null>(cache);
  useEffect(() => {
    subscribers.add(setStats);
    if (subscribers.size === 1) {
      refresh();
      timer = setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    }
    return () => {
      subscribers.delete(setStats);
      if (subscribers.size === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, []);
  return stats;
}
