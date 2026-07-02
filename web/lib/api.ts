// Typed client for the FastAPI ML/physics service.

import type {
  BallPrediction,
  LaunchInput,
  ClipAnalysis,
  Workout,
  CatalogueDrill,
  TrafficStats,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_ML_URL ?? "http://127.0.0.1:8000";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
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

  // Fire-and-forget pageview ping. Never throws; never blocks the UI.
  track: (path: string, session: string, referrer?: string | null) => {
    try {
      fetch(`${BASE}/analytics/track`, {
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

  stats: () => get<TrafficStats>("/analytics/stats"),

  // Count one on-device analysis. Fire-and-forget; never throws.
  recordAnalysis: (frames = 0) => {
    try {
      fetch(`${BASE}/analytics/analysis?frames=${Math.max(0, Math.min(frames, 600))}`, {
        method: "POST",
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  },
};
