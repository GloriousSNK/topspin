"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getSessions, getCustomDrills, type SessionRow, type CustomDrillRow } from "@/lib/history";
import { api } from "@/lib/api";
import type { Workout } from "@/lib/types";

export default function Stats() {
  const { user, enabled, loading } = useAuth();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [saved, setSaved] = useState<CustomDrillRow[]>([]);
  const [load, setLoad] = useState(true);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) { setLoad(false); return; }
    Promise.all([getSessions(), getCustomDrills(50)]).then(([r, s]) => {
      setRows(r); setSaved(s); setLoad(false);
    });
  }, [user]);

  const topFlaws = useMemo(() => {
    const count = new Map<string, { id: string; label: string; coaching_cue: string; n: number }>();
    for (const s of rows.slice(0, 20))
      for (const f of s.flaws ?? []) {
        const e = count.get(f.id) ?? { id: f.id, label: f.label, coaching_cue: f.coaching_cue, n: 0 };
        e.n += 1; count.set(f.id, e);
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

  if (!enabled) return <Msg title="Stats" body="Accounts aren't set up on this deployment yet." />;
  if (loading || load) return <div className="h1">Stats</div>;
  if (!user) return <Msg title="Stats" body="Sign in to track your form and save drills." cta />;

  const scored = rows.filter((r) => typeof r.form_score === "number");
  const avg = scored.length ? Math.round(scored.reduce((s, r) => s + r.form_score, 0) / scored.length) : 0;
  const best = scored.reduce((m, r) => Math.max(m, r.form_score), 0);
  const chrono = [...scored].reverse();
  const recent = scored.length ? scored[0].form_score : 0; // most recent form
  const nothing = rows.length === 0 && saved.length === 0;

  return (
    <div>
      <span className="eyebrow">Your numbers</span>
      <div className="h1">Stats</div>
      <p className="lead">{rows.length} analyses · {saved.length} saved. Watch your form climb and keep your drills in one place.</p>

      {nothing ? (
        <div className="card"><p style={{ color: "var(--ink-soft)" }}>
          Nothing yet. Run one in <Link href="/analyze" style={{ color: "var(--court)" }}>Clip Analysis</Link> or save a drill in <Link href="/workouts" style={{ color: "var(--court)" }}>Drills</Link>.
        </p></div>
      ) : (
        <>
          {/* headline progress bar */}
          <div className="card" style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <span style={{ fontWeight: 700 }}>Current form</span>
              <span className="mono" style={{ color: "var(--court)", fontWeight: 800, fontSize: 20 }}>{recent}/100</span>
            </div>
            <div style={{ position: "relative", height: 16, background: "var(--paper-2)", border: "2px solid var(--ink)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${recent}%`, height: "100%", background: "var(--accent)" }} />
              {/* average marker */}
              {avg > 0 && (
                <div title={`Average ${avg}`} style={{ position: "absolute", left: `${avg}%`, top: -3, bottom: -3, width: 3, background: "var(--ink)" }} />
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-soft)", marginTop: 6 }}>
              <span>most recent</span>
              <span>average {avg} · best {best}</span>
            </div>
          </div>

          <div className="grid grid-4" style={{ marginBottom: 18 }}>
            <Stat v={rows.length} l="Analyses" />
            <Stat v={avg} l="Average form" accent />
            <Stat v={best} l="Best form" />
            <Stat v={saved.length} l="Saved drills" />
          </div>

          {chrono.length >= 2 && (
            <div className="card" style={{ marginBottom: 18 }}>
              <div className="card-title">Form score over time</div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: 150, fontSize: 10, color: "var(--ink-soft)" }}>
                  <span>100</span><span>50</span><span>0</span>
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 6, height: 150, borderBottom: "2px solid var(--ink)", borderTop: "1px dashed var(--paper-2)" }}>
                  {chrono.map((r) => (
                    <div key={r.id} title={`${r.stroke} · ${r.form_score}/100 · ${new Date(r.created_at).toLocaleDateString()}`}
                      style={{ flex: 1, minWidth: 4, height: `${Math.max(3, r.form_score)}%`, background: "var(--accent)", border: "2px solid var(--ink)", borderRadius: "5px 5px 0 0" }} />
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-soft)", marginTop: 6, marginLeft: 34 }}>
                <span>{new Date(chrono[0].created_at).toLocaleDateString()}</span>
                <span>{new Date(chrono[chrono.length - 1].created_at).toLocaleDateString()}</span>
              </div>
            </div>
          )}

          {/* saved drills & workouts */}
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="card-title">Saved drills & workouts</div>
            {saved.length === 0 ? (
              <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>
                Nothing saved yet. Search a drill or build a workout in <Link href="/workouts" style={{ color: "var(--court)" }}>Drills</Link> and hit Save.
              </p>
            ) : (
              <div className="grid grid-2">
                {saved.map((row) => <SavedItem key={row.id} row={row} />)}
              </div>
            )}
          </div>

          {topFlaws.length > 0 && (
            <div className="card" style={{ marginBottom: 18 }}>
              <div className="card-title">Your recurring flaws</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {topFlaws.map((f) => <span key={f.id} className="pill off">{f.label} ×{f.n}</span>)}
              </div>
              <button className="btn" onClick={adaptive} disabled={busy}>{busy ? "Building…" : "Build a session for these →"}</button>
            </div>
          )}

          {workout && (
            <div className="card" style={{ marginBottom: 18 }}>
              <div className="card-title">{workout.title} · {workout.total_minutes} min</div>
              <div className="grid grid-2">
                {workout.drills.map((d) => (
                  <div key={d.id} className="subcard">
                    <strong>{d.name}</strong>
                    <div style={{ color: "var(--ink-soft)", fontSize: 13, margin: "4px 0 8px" }}>{d.focus}</div>
                    <span className="pill">{d.sets} × {d.reps}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rows.length > 0 && (
            <div className="card">
              <div className="card-title">History</div>
              <div className="table-wrap">
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
            </div>
          )}
        </>
      )}
    </div>
  );
}

// A saved item is either a single drill or a whole workout (kind: "workout").
function SavedItem({ row }: { row: CustomDrillRow }) {
  const d = row.drill as unknown as {
    kind?: string; name?: string; title?: string; focus?: string; category?: string;
    sets?: number; reps?: number; total_minutes?: number; drills?: { id: string; name: string }[];
  };
  if (d.kind === "workout") {
    return (
      <div className="subcard">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <strong>{d.title || "Workout"}</strong>
          <span className="tag">{d.total_minutes}m</span>
        </div>
        <div style={{ color: "var(--ink-soft)", fontSize: 13, marginTop: 5 }}>
          {(d.drills ?? []).length} drills: {(d.drills ?? []).slice(0, 4).map((x) => x.name).join(", ")}
          {(d.drills ?? []).length > 4 ? "…" : ""}
        </div>
      </div>
    );
  }
  return (
    <div className="subcard">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong>{d.name}</strong>
        {d.category && <span className="tag">{d.category}</span>}
      </div>
      {d.focus && <div style={{ color: "var(--ink-soft)", fontSize: 13, margin: "5px 0 8px" }}>{d.focus}</div>}
      {d.sets && <span className="pill">{d.sets} × {d.reps}</span>}
    </div>
  );
}

function Stat({ v, l, accent }: { v: number; l: string; accent?: boolean }) {
  return <div className="card" style={{ padding: 16 }}><div className="stat">
    <span className="stat-value" style={{ fontSize: 24, color: accent ? "var(--court)" : "var(--ink)" }}>{v}</span>
    <span className="stat-label">{l}</span></div></div>;
}

function Msg({ title, body, cta }: { title: string; body: string; cta?: boolean }) {
  return <div><div className="h1">{title}</div><p className="lead">{body}</p>
    {cta && <Link href="/account" className="btn">Sign in</Link>}</div>;
}
