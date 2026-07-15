"use client";

import { useSyncExternalStore } from "react";
import { api } from "./api";

export type BackendState = "idle" | "waking" | "ready" | "error";

let state: BackendState = "idle";
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: BackendState) {
  state = next;
  for (const listener of listeners) listener();
}

export function warmBackend(force = false): Promise<void> {
  if (state === "ready" && !force) return Promise.resolve();
  if (inFlight) return inFlight;
  publish("waking");
  inFlight = api.health()
    .then(() => publish("ready"))
    .catch(() => publish("error"))
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
