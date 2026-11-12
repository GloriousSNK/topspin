// Run non-urgent work once the main thread is idle (after hydration/paint),
// with a timeout so it still happens on a busy page. Returns a cancel function.

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

export function onIdle(task: () => void, timeout = 1500): () => void {
  if (typeof window === "undefined") return () => {};
  const w = window as IdleWindow;
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(task, { timeout });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(task, Math.min(timeout, 200));
  return () => window.clearTimeout(id);
}
