"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getSessions, getCustomDrills, deleteCustomDrill, renameCustomDrill, type SessionRow, type CustomDrillRow } from "@/lib/history";
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
    let alive = true;
    if (!user) { setLoad(false); return; }
    Promise.all([getSessions(), getCustomDrills(50)]).then(([r, s]) => {
      if (!alive) return;
      setRows(r); setSaved(s); setLoad(false);
    });
    return () => { alive = false; };
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

  async function removeSaved(id: string) {
    const prev = saved;
    setSaved((s) => s.filter((r) => r.id !== id)); // optimistic
    const ok = await deleteCustomDrill(id);
    if (!ok) setSaved(prev); // roll back on failure
  }

  async function renameSaved(id: string, title: string) {
    const prev = saved;
    setSaved((s) => s.map((r) => {
      if (r.id !== id) return r;
      const d = r.drill as unknown as Record<string, unknown>;
      return { ...r, drill: (d.kind === "workout" ? { ...d, title } : { ...d, name: title }) as unknown as CustomDrillRow["drill"] };
    }));
    const ok = await renameCustomDrill(id, title);
    if (!ok) setSaved(prev); // roll back if the write was rejected
  }

  async function adaptive() {
    setBusy(true);
    try {
      const flaws = topFlaws.map((f, i) => ({ id: f.id, label: f.label, coaching_cue: f.coaching_cue, severity: 0.8 - i * 0.1 }));
      setWorkout(await api.workoutFromFlaws(flaws, "intermediate", 45));
    } finally { setBusy(false); }
  }

  if (!enabled) return <Msg title="Stats" body="Accounts aren't connected on this copy of the app — add the Supabase keys to web/.env.local to enable sign-in and saved stats." />;
  if (loading || load) return <h1 className="h1">Stats</h1>;
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
      <h1 className="h1">Stats</h1>
      <p className="lead">{rows.length} analyses · {saved.length} saved. Watch your form climb and keep your drills in one place.</p>

      {nothing ? (
        <div className="card"><p style={{ color: "var(--ink-soft)" }}>
          Nothing yet. Run one in <Link href="/analyze" style={{ color: "var(--court)" }}>Clip Analysis</Link> or save a drill in <Link href="/workouts" style={{ color: "var(--court)" }}>Drills</Link>.
        </p></div>
      ) : (
        <>
          {/* headline progress bar */}
          <div className="lp-panel lp-tick-b" style={{ marginBottom: 18, padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <span style={{ fontWeight: 650 }}>Current form</span>
              <span className="mono" style={{ color: "var(--green)", fontWeight: 600, fontSize: 20 }}>{recent}/100</span>
            </div>
            <div style={{ position: "relative", height: 16, background: "var(--paper-2)", border: "1px solid var(--line)", borderRadius: 999, overflow: "hidden" }}>
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
            <div className="lp-panel" style={{ marginBottom: 18 }}>
              <div className="lp-panel-head">
                <span>Form score over time</span>
                <span className="val">AVG {avg}</span>
              </div>
              <div style={{ padding: 18 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: 150, fontSize: 10, color: "var(--ink-soft)" }}>
                  <span>100</span><span>50</span><span>0</span>
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 6, height: 150, borderBottom: "1px solid rgba(29,34,27,0.4)", borderTop: "1px dashed var(--line-soft)" }}>
                  {chrono.map((r) => (
                    <div key={r.id} title={`${r.stroke} · ${r.form_score}/100 · ${new Date(r.created_at).toLocaleDateString()}`}
                      style={{ flex: 1, minWidth: 4, height: `${Math.max(3, r.form_score)}%`, background: "var(--accent)", border: "1px solid rgba(29,34,27,0.35)", borderRadius: "5px 5px 0 0" }} />
                  ))}
                </div>
              </div>
              </div>
              <div className="lp-panel-foot">
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
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {saved.map((row) => (
                  <SavedItem key={row.id} row={row}
                    onDelete={() => removeSaved(row.id)}
                    onRename={(t) => renameSaved(row.id, t)} />
                ))}
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

interface WorkoutDrill { id?: string; name: string; focus?: string; category?: string; sets?: number; reps?: number; est_minutes?: number; intensity?: string; }
interface SavedShape {
  kind?: string; name?: string; title?: string; focus?: string; category?: string; goal?: string; notes?: string;
  intensity?: string; sets?: number; reps?: number; steps?: string[]; total_minutes?: number; level?: string; drills?: WorkoutDrill[];
}

// A saved item is either a single drill or a whole workout (kind: "workout").
// Expandable, renameable, deletable.
function SavedItem({ row, onDelete, onRename }: { row: CustomDrillRow; onDelete: () => void; onRename: (title: string) => void }) {
  const d = row.drill as unknown as SavedShape;
  const isWorkout = d.kind === "workout";
  const heading = (isWorkout ? d.title : d.name) || (isWorkout ? "Workout" : "Drill");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(heading);

  function saveName() {
    const t = name.trim();
    if (t && t !== heading) onRename(t);
    else setName(heading);
    setEditing(false);
  }
  function remove() {
    if (confirm(`Delete "${heading}"? This can't be undone.`)) onDelete();
  }

  return (
    <div className="subcard">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {editing ? (
          <input className="select" style={{ flex: 1, minWidth: 160, textTransform: "none", padding: "4px 8px" }}
            value={name} autoFocus maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setName(heading); setEditing(false); } }}
            onBlur={saveName} />
        ) : (
          <button onClick={() => setOpen((o) => !o)}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", fontWeight: 700, textAlign: "left", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>{open ? "▾" : "▸"}</span>
            {heading}
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="tag">{isWorkout ? `${d.total_minutes}m · ${(d.drills ?? []).length} drills` : d.category}</span>
          <button className="icon-btn" title="Rename" onClick={() => { setEditing(true); setName(heading); }}>✎</button>
          <button className="icon-btn" title="Delete" onClick={remove} style={{ color: "var(--danger)" }}>✕</button>
        </div>
      </div>

      {/* collapsed summary line */}
      {!open && (
        <div style={{ color: "var(--ink-soft)", fontSize: 13, marginTop: 6 }}>
          {isWorkout
            ? <>{(d.drills ?? []).slice(0, 3).map((x) => x.name).join(", ")}{(d.drills ?? []).length > 3 ? "…" : ""}</>
            : <>{d.focus}{d.sets ? ` · ${d.sets} × ${d.reps}` : ""}</>}
        </div>
      )}

      {/* expanded full view */}
      {open && (
        <div style={{ marginTop: 10 }}>
          {isWorkout ? (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {d.level && <span className="pill">{d.level}</span>}
                {d.goal && <span className="pill off">{String(d.goal).replace(/_/g, " ")}</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(d.drills ?? []).map((x, i) => (
                  <div key={x.id ?? i} style={{ borderLeft: "3px solid var(--accent)", paddingLeft: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <strong style={{ fontSize: 14 }}>{x.name}</strong>
                      {x.est_minutes != null && <span className="tag">{x.est_minutes}m</span>}
                    </div>
                    {x.focus && <div style={{ color: "var(--ink-soft)", fontSize: 13, margin: "3px 0" }}>{x.focus}</div>}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {x.sets != null && <span className="pill">{x.sets} × {x.reps}</span>}
                      {x.intensity && <span className="pill">{x.intensity}</span>}
                      {x.category && <span className="pill">{x.category}</span>}
                    </div>
                  </div>
                ))}
              </div>
              {d.notes && <p style={{ color: "var(--ink-soft)", fontSize: 13, marginTop: 10 }}>{d.notes}</p>}
            </>
          ) : (
            <>
              {d.focus && <div style={{ color: "var(--ink-soft)", fontSize: 13, marginBottom: 8 }}>{d.focus}</div>}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: d.steps?.length ? 10 : 0 }}>
                {d.sets != null && <span className="pill">{d.sets} × {d.reps}</span>}
                {d.intensity && <span className="pill">{d.intensity}</span>}
                {d.category && <span className="pill">{d.category}</span>}
              </div>
              {(d.steps ?? []).length > 0 && (
                <ol style={{ margin: 0, paddingLeft: 18, color: "var(--ink-soft)", fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
                  {(d.steps ?? []).map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ v, l, accent }: { v: number; l: string; accent?: boolean }) {
  return <div className="card" style={{ padding: 16 }}><div className="stat">
    <span className="stat-value" style={{ fontSize: 24, color: accent ? "var(--court)" : "var(--ink)" }}>{v}</span>
    <span className="stat-label">{l}</span></div></div>;
}

function Msg({ title, body, cta }: { title: string; body: string; cta?: boolean }) {
  return <div><h1 className="h1">{title}</h1><p className="lead">{body}</p>
    {cta && <Link href="/account" className="btn">Sign in</Link>}</div>;
}
