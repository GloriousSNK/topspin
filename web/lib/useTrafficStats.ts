"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import type { TrafficStats } from "./types";

/*
 * Shared, memoised read of the self-hosted analytics. Several bits of the
 * landing page want the same live numbers (the marquee, the count-up band), so
 * we fetch once at the module level and hand the result to every caller instead
 * of firing a request per component.
 */

let cache: TrafficStats | null = null;
let inflight: Promise<TrafficStats | null> | null = null;

function load(): Promise<TrafficStats | null> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = api
      .stats()
      .then((s) => { cache = s; return s; })
      .catch(() => null)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function useTrafficStats(): TrafficStats | null {
  const [stats, setStats] = useState<TrafficStats | null>(cache);
  useEffect(() => {
    let alive = true;
    load().then((s) => { if (alive && s) setStats(s); });
    return () => { alive = false; };
  }, []);
  return stats;
}
