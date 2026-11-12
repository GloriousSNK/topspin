"use client";

import { useCallback, useEffect } from "react";
import { onIdle } from "./idle";

// Pre-loads the MediaPipe pose model on the analysis pages only (/analyze and
// /batch call this), so the first clip doesn't wait for a multi-MB model and
// WASM download plus GPU init. The model code is still a dynamic import, so no
// other page pays for it.
//
// - On mount, once the browser is idle (after first paint and hydration).
// - Immediately on intent: the returned `warm` is wired to hover/focus/drag on
//   the dropzone, in case the user gets there before the idle callback fires.
// Both paths share one memoised load inside lib/pose.ts, so this is idempotent.

let requested = false;

export function warmPose(): void {
  if (requested || typeof window === "undefined") return;
  // Respect data saver: the model is large; load it only when a clip is chosen.
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return;
  requested = true;
  import("@/lib/pose")
    .then((m) => m.warmPoseModel())
    .catch(() => { requested = false; });
}

export function usePoseWarmup(): () => void {
  useEffect(() => onIdle(warmPose, 3000), []);
  return useCallback(() => warmPose(), []);
}
