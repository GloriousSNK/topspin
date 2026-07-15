"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import type { PoseAnalysis } from "@/lib/pose";
import { saveSession } from "@/lib/history";
import { syncPlayerSummary } from "@/lib/coach";
import { saveLocalSession } from "@/lib/localHistory";

type BatchItem = { id: string; file: File; state: "queued" | "running" | "done" | "failed"; result?: PoseAnalysis; error?: string };

export default function BatchAnalysis() {
  const { user } = useAuth();
  const [items, setItems] = useState<BatchItem[]>([]);
  const [stroke, setStroke] = useState("auto");
  const [running, setRunning] = useState(false);
  const owner = useRef<string | null>(user?.id ?? null);
  owner.current = user?.id ?? null;

  function add(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files).filter((f) => !f.type || f.type.startsWith("video/")).slice(0, Math.max(0, 8 - items.length));
    setItems((old) => [...old, ...incoming.map((file) => ({ id: crypto.randomUUID(), file, state: "queued" as const }))]);
  }

  async function run() {
    if (!items.length || running) return;
    const accountId = owner.current;
    setRunning(true);
    const { analyzeStroke } = await import("@/lib/pose");
    for (const original of items) {
      setItems((all) => all.map((x) => x.id === original.id ? { ...x, state: "running" } : x));
      try {
        const result = await analyzeStroke(original.file, stroke);
        if (accountId && owner.current !== accountId) break;
        setItems((all) => all.map((x) => x.id === original.id ? { ...x, state: "done", result } : x));
        if (accountId) {
          await saveSession(result, accountId).catch(() => false);
          await syncPlayerSummary(accountId, result.stroke, result.formScore).catch(() => false);
        } else saveLocalSession(result);
      } catch (error) {
        setItems((all) => all.map((x) => x.id === original.id ? { ...x, state: "failed", error: error instanceof Error ? error.message : "Analysis failed" } : x));
      }
    }
    setRunning(false);
  }

  return <div>
    <span className="eyebrow">Session mode</span>
    <h1 className="h1">Batch analysis</h1>
    <p className="lead">Queue up to eight clips. TopSpin runs the same on-device analysis one clip at a time, so your browser stays responsive.</p>
    <div className="card" style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div><label className="label" htmlFor="batch-stroke">Stroke</label><select id="batch-stroke" className="select" value={stroke} onChange={(e) => setStroke(e.target.value)}><option value="auto">Auto</option><option value="forehand">Forehand</option><option value="backhand">Backhand</option><option value="serve">Serve</option><option value="volley">Volley</option><option value="slice">Slice</option></select></div>
        <label className="btn btn-ghost" style={{ cursor: "pointer" }}>Add clips<input type="file" accept="video/*" multiple hidden onChange={(e) => add(e.target.files)} /></label>
        <button className="btn" onClick={run} disabled={running || !items.length}>{running ? "Analysing..." : `Analyse ${items.length || ""} clips`}</button>
        <button className="btn btn-ghost" onClick={() => setItems([])} disabled={running || !items.length}>Clear</button>
      </div>
    </div>
    {!items.length ? <div className="card" style={{ textAlign: "center", padding: 40 }}><p style={{ color: "var(--ink-soft)" }}>Add a few clips from the same practice session to begin.</p></div> :
      <div className="batch-list">{items.map((item, index) => <div className="batch-row" key={item.id}>
        <span className="batch-index">{String(index + 1).padStart(2, "0")}</span><div style={{ minWidth: 0, flex: 1 }}><strong className="truncate">{item.file.name}</strong><div style={{ color: item.state === "failed" ? "var(--danger)" : "var(--ink-soft)", fontSize: 12 }}>{item.state === "done" ? `${item.result?.stroke} · ${item.result?.formScore}/100` : item.error ?? item.state}</div></div>
        {item.result && <Link className="btn btn-ghost" href="/stats">Stats</Link>}
      </div>)}</div>}
  </div>;
}
