"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getSessions, type SessionRow } from "@/lib/history";
import { api } from "@/lib/api";
import type { Workout } from "@/lib/types";

export default function Progress() {
  const { user, enabled, loading } = useAuth();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [load, setLoad] = useState(true);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) { setLoad(false); return; }
    getSessions().then((r) => { setRows(r); setLoad(false); });
  }, [user]);

  // Aggregate the most frequent recent flaws to drive an adaptive session.
  const topFlaws = useMemo(() => {
    const count = new Map<string, { id: string; label: string; coaching_cue: string; n: number }>();
    for (const s of rows.slice(0, 20)) {
      for (const f of s.flaws ?? []) {
        const e = count.get(f.id) ?? { id: f.id, label: f.label, coaching_cue: f.coaching_cue, n: 0 };
        e.n += 1; count.set(f.id, e);
      }
    }
    return [...count.values()].sort((a, b) => b.n - a.n).slice(0, 4);
  }, [rows]);

  async function adaptive() {
    setBusy(true);
    try {
      const flaws = topFlaws.map((f, i) => ({ id: f.id, label: f.label, coaching_cue: f.coaching_cue, severity: 0.8 - i * 0.1 }));
      setWorkout(await api.workoutFromFlaws(flaws, "intermediate", 45));
    } finally { setBusy(false); }
  }

  if (!enabled) return <Msg title="Progress" body="Accounts aren't set up on this deployment yet." />;
  if (loading || load) return <div className="h1">Progress</div>;
  if (!user) return <Msg title="Progress" body="Sign in to track your form over time." cta />;

  const scored = rows.filter((r) => typeof r.form_score === "number");
  const avg = scored.length ? Math.round(scored.reduce((s, r) => s + r.form_score, 0) / scored.length) : 0;
  const best = scored.reduce((m, r) => Math.max(m, r.form_score), 0);
  const chrono = [...scored].reverse(); // oldest -> newest for the trend

  return (
    <div>
      <div className="h1">Your progress</div>
      <p className="lead">{rows.length} analyses saved. Watch your form trend and turn your recurring flaws into a session.</p>

      {rows.length === 0 ? (
        <div className="card"><p style={{ color: "var(--ink-soft)" }}>No analyses yet. Run one in <Link href="/analyze" style={{ color: "var(--court)" }}>Clip Analysis</Link> and it&apos;ll show up here.</p></div>
      ) : (
        <>
          <div className="grid grid-3" style={{ marginBottom: 18 }}>
            <Stat v={rows.length} l="Analyses" />
            <Stat v={avg} l="Average form" accent />
            <Stat v={best} l="Best form" />
          </div>

          <div className="card" style={{ marginBottom: 18 }}>
            <div className="card-title">Form score over time</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 150, paddingTop: 8 }}>
              {chrono.map((r) => (
                <div key={r.id} title={`${r.stroke} · ${r.form_score}/100 · ${new Date(r.created_at).toLocaleDateString()}`}
                  style={{ flex: 1, minWidth: 4, height: `${Math.max(4, r.form_score)}%`,
                    background: "var(--accent)", border: "2px solid var(--ink)", borderRadius: "5px 5px 0 0" }} />
              ))}
            </div>
          </div>

          {topFlaws.length > 0 && (
            <div className="card" style={{ marginBottom: 18 }}>
              <div className="card-title">Your recurring flaws</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {topFlaws.map((f) => <span key={f.id} className="pill off">{f.label} ×{f.n}</span>)}
              </div>
              <button className="btn" onClick={adaptive} disabled={busy}>
                {busy ? "Building…" : "Build a session for these →"}
              </button>
            </div>
          )}

          {workout && (
            <div className="card" style={{ marginBottom: 18 }}>
              <div className="card-title">{workout.title} · {workout.total_minutes} min</div>
              <div className="grid grid-2">
                {workout.drills.map((d) => (
                  <div key={d.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
                    <strong>{d.name}</strong>
                    <div style={{ color: "var(--muted)", fontSize: 13, margin: "4px 0 8px" }}>{d.focus}</div>
                    <span className="pill">{d.sets} × {d.reps}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-title">History</div>
            <table className="data">
              <thead><tr><th>Date</th><th>Stroke</th><th>Form</th><th>Serve</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ color: "var(--ink-soft)" }}>{new Date(r.created_at).toLocaleDateString()}</td>
                    <td style={{ textTransform: "capitalize" }}>{r.stroke}</td>
                    <td className="mono">{r.form_score}/100</td>
                    <td className="mono">{r.serve_speed ? `~${r.serve_speed} km/h` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ v, l, accent }: { v: number; l: string; accent?: boolean }) {
  return <div className="card" style={{ padding: 16 }}><div className="stat">
    <span className="stat-value" style={{ color: accent ? "var(--court)" : "var(--ink)" }}>{v}</span>
    <span className="stat-label">{l}</span></div></div>;
}

function Msg({ title, body, cta }: { title: string; body: string; cta?: boolean }) {
  return <div><div className="h1">{title}</div><p className="lead">{body}</p>
    {cta && <Link href="/account" className="btn">Sign in</Link>}</div>;
}
