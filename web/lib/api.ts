// Typed client for the FastAPI ML/physics service.

import type {
  BallPrediction,
  LaunchInput,
  ClipAnalysis,
  Workout,
  CatalogueDrill,
  TrafficStats,
  GeneratedDrill,
} from "./types";
import { markBackendReady } from "./backendStatus";
import { getSessionId } from "./analyticsSession";

const BASE = process.env.NEXT_PUBLIC_ML_URL
  ?? (process.env.NODE_ENV === "production" ? "https://tennis-ml.onrender.com" : "http://127.0.0.1:8000");

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  markBackendReady();
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  markBackendReady();
  return res.json() as Promise<T>;
}

export const api = {
  base: BASE,

  health: () => get<{ status: string }>("/health"),

  predictBall: (launch: LaunchInput, ensembleSamples = 250) =>
    post<BallPrediction>("/predict/ball", {
      launch,
      run_chaos: true,
      ensemble_samples: ensembleSamples,
    }),

  uploadClip: async (file: File, stroke?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    if (stroke) fd.append("stroke", stroke);
    const res = await fetch(`${BASE}/analyze/upload`, { method: "POST", body: fd });
    if (!res.ok) throw new Error(`upload -> ${res.status} ${await res.text()}`);
    markBackendReady();
    return res.json() as Promise<{ clip_id: string; filename: string; size_bytes: number }>;
  },

  analyzeClip: (clipId: string, durationS = 2.0, stroke?: string) =>
    post<ClipAnalysis>("/analyze/clip", { clip_id: clipId, duration_s: durationS, stroke }),

  catalogue: () => get<{ drills: CatalogueDrill[] }>("/drills/catalogue"),

  workoutFromFlaws: (
    flaws: Array<{ id: string; label?: string; severity?: number; coaching_cue?: string }>,
    level = "intermediate",
    maxMinutes = 45,
  ) => post<Workout>("/drills/from-flaws", { flaws, level, max_minutes: maxMinutes }),

  workoutByGoal: (goal: string, level = "intermediate", maxMinutes = 45) =>
    post<Workout>("/drills/by-goal", { goal, level, max_minutes: maxMinutes }),

  generateDrill: (goal: string) => post<GeneratedDrill>("/drills/dynamic", { goal }),

  // Fire-and-forget pageview ping. Never throws; never blocks the UI.
  track: (path: string, session: string, referrer?: string | null) => {
    try {
      fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: path.slice(0, 256),
          session: session.slice(0, 64),
          referrer: referrer ? referrer.slice(0, 256) : null,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  },

  stats: async () => {
    const res = await fetch("/api/analytics/stats", { cache: "no-store" });
    if (!res.ok) throw new Error(`analytics/stats -> ${res.status}`);
    markBackendReady();
    return res.json() as Promise<TrafficStats>;
  },

  // Count one on-device analysis. Fire-and-forget; never throws.
  recordAnalysis: (seconds = 0, frames = 0) => {
    try {
      const s = Math.max(0, Math.min(Math.round(seconds), 3600));
      const f = Math.max(0, Math.min(Math.round(frames), 200000));
      fetch(`${BASE}/analytics/analysis?seconds=${s}&frames=${f}`, {
        method: "POST",
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  },

  // Mark that this browser session actually USED a tool (analysis / simulation /
  // workout), not just visited the page. Recorded via the session-carrying track
  // proxy under a "/used/<tool>" path so "athletes served" can count real
  // engagement. Fired at most once per tool per tab-session to keep the event
  // log lean while still re-registering on later visits (survives pruning).
  recordEngagement: (tool: string) => {
    try {
      if (typeof window === "undefined") return;
      const key = `ts_used_${tool}`;
      if (sessionStorage.getItem(key)) return;
      const sid = getSessionId();
      if (!sid) return;
      sessionStorage.setItem(key, "1");
      api.track(`/used/${tool}`, sid);
    } catch {
      /* analytics must never affect the app */
    }
  },
};
