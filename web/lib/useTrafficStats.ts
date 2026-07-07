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

async function refresh(): Promise<void> {
  try {
    cache = await api.stats();
    for (const fn of subscribers) fn(cache);
  } catch {
    /* keep the last good value on a transient blip */
  }
}

export function useTrafficStats(): TrafficStats | null {
  const [stats, setStats] = useState<TrafficStats | null>(cache);
  useEffect(() => {
    subscribers.add(setStats);
    setStats(cache); // sync to whatever the shared cache already holds
    if (subscribers.size === 1) {
      refresh();
      timer = setInterval(refresh, 15000);
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
