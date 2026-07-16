"use client";

import { useSyncExternalStore } from "react";

const BASE = process.env.NEXT_PUBLIC_ML_URL
  ?? (process.env.NODE_ENV === "production" ? "https://tennis-ml.onrender.com" : "http://127.0.0.1:8000");

export type BackendState = "idle" | "waking" | "ready" | "error";

let state: BackendState = "idle";
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: BackendState) {
  state = next;
  for (const listener of listeners) listener();
}

export function markBackendReady() {
  if (state !== "ready") publish("ready");
}

export function warmBackend(force = false): Promise<void> {
  if (state === "ready" && !force) return Promise.resolve();
  if (inFlight) return inFlight;
  publish("waking");
  inFlight = fetch(`${BASE}/health`, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("Backend unavailable");
      markBackendReady();
    })
    .catch(() => { if (state !== "ready") publish("error"); })
    .finally(() => { inFlight = null; });
  return inFlight;
}

export function useBackendState(): BackendState {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => state,
    () => "idle",
  );
}
