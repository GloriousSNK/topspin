"use client";

import { useEffect, useState } from "react";
import { useBackendState, warmBackend } from "@/lib/backendStatus";

export function BackendStatusBanner() {
  const status = useBackendState();
  const [visible, setVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => { void warmBackend(); }, []);
  useEffect(() => {
    if (status !== "waking" && status !== "error") {
      const reset = window.setTimeout(() => {
        setVisible(false);
        setElapsed(0);
      }, 0);
      return () => window.clearTimeout(reset);
    }
    const shown = window.setTimeout(() => setVisible(true), status === "error" ? 0 : 1200);
    const clock = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    const retry = status === "error" ? window.setTimeout(() => void warmBackend(true), 5000) : undefined;
    return () => {
      window.clearTimeout(shown);
      window.clearInterval(clock);
      if (retry) window.clearTimeout(retry);
    };
  }, [status]);

  if (!visible) return null;
  return (
    <aside className="backend-banner" role="status" aria-live="polite">
      <div className="backend-flight" aria-hidden="true"><span /></div>
      <div className="backend-copy">
        <strong>{status === "error" ? "Still starting the TopSpin server" : "Starting the TopSpin server"}</strong>
        <span>The free physics server sleeps between visits. Keep this tab open and we’ll continue automatically.</span>
      </div>
      <span className="backend-time mono">{elapsed}s</span>
      {status === "error" && <button className="btn btn-ghost" onClick={() => void warmBackend(true)}>Try again</button>}
    </aside>
  );
}

export function BackendWakeupPanel({ title = "Starting the TopSpin server" }: { title?: string }) {
  const status = useBackendState();
  useEffect(() => { void warmBackend(); }, []);
  return (
    <div className="backend-panel" role="status" aria-live="polite">
      <div className="backend-court" aria-hidden="true"><span /></div>
      <div>
        <span className="eyebrow">Server status</span>
        <h2>{title}</h2>
        <p>The free server may need about 30 seconds after sitting idle. This page will update on its own.</p>
        {status === "error" && <button className="btn btn-ghost" onClick={() => void warmBackend(true)}>Try again</button>}
      </div>
    </div>
  );
}
