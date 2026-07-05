"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Workout, CatalogueDrill } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { saveCustomDrill, saveWorkout } from "@/lib/history";

const GOALS = ["all_round", "consistency", "power", "footwork", "serve", "volley"];
const LEVELS = ["beginner", "intermediate", "advanced"];

// Rank a catalogue drill against the search terms — simple text similarity.
function scoreDrill(d: CatalogueDrill, terms: string[]): number {
  const hay = `${d.name} ${d.focus} ${d.category} ${d.equipment} ${(d.addresses || []).join(" ")}`.toLowerCase();
  const words = hay.split(/\W+/);
  let score = 0;
  for (const t of terms) {
    if (hay.includes(t)) score += 3;
    else if (words.some((w) => w.length > 2 && (w.startsWith(t) || t.startsWith(w)))) score += 1;
  }
  return score;
}

export default function Workouts() {
  const { user } = useAuth();
  const [goal, setGoal] = useState("all_round");
  const [level, setLevel] = useState("intermediate");
  const [minutes, setMinutes] = useState(45);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [catalogue, setCatalogue] = useState<CatalogueDrill[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [workoutSaved, setWorkoutSaved] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api.catalogue().then((r) => setCatalogue(r.drills)).catch((e) => setErr(String(e)));
  }, []);

  const results = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
    if (!terms.length) return [];
    return catalogue
      .map((d) => ({ d, s: scoreDrill(d, terms) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map((x) => x.d);
  }, [query, catalogue]);

  async function generate() {
    setBusy(true); setErr(null); setWorkoutSaved(false);
    try {
      setWorkout(await api.workoutByGoal(goal, level, minutes));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveDrill(d: CatalogueDrill) {
    const ok = await saveCustomDrill({
      name: d.name, focus: d.focus, category: d.category, intensity: d.intensity,
      sets: d.default_sets, reps: d.default_reps, steps: [], goal: d.category,
    });
    if (ok) {
      setSavedIds((prev) => new Set(prev).add(d.id));
      setSaveMsg({ ok: true, text: "Saved to your Stats page." });
    } else {
      setSaveMsg({ ok: false, text: "Couldn't save — make sure you're signed in and try again." });
    }
  }

  async function saveGoalWorkout() {
    if (!workout) return;
    const ok = await saveWorkout(workout);
    setWorkoutSaved(ok);
    setSaveMsg(ok
      ? { ok: true, text: "Workout saved to your Stats page." }
      : { ok: false, text: "Couldn't save — make sure you're signed in and try again." });
  }

  return (
    <div>
      <span className="eyebrow">Practice</span>
      <h1 className="h1">Drills & Workouts</h1>
      <p className="lead">
        Pick a goal and hit Generate for a ready-made session — or scroll down to browse all
        {" "}{catalogue.length || 34} drills. Sessions from a clip analysis pull straight from here.
      </p>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Build a session</div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Goal">
            <select value={goal} onChange={(e) => setGoal(e.target.value)} className="select">
              {GOALS.map((g) => <option key={g} value={g}>{g.replace("_", " ")}</option>)}
            </select>
          </Field>
          <Field label="Level">
            <select value={level} onChange={(e) => setLevel(e.target.value)} className="select">
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
          <Field label={`Duration · ${minutes} min`}>
            <input className="range" style={{ width: 180 }} type="range" min={15} max={90} step={5}
              value={minutes} onChange={(e) => setMinutes(parseInt(e.target.value))} />
          </Field>
          <button className="btn" onClick={generate} disabled={busy}>
            {busy ? "Building…" : "Generate workout"}
          </button>
        </div>
        {err && <div style={{ color: "var(--danger)", marginTop: 12, fontSize: 13 }}>{err}</div>}
      </div>

      {saveMsg && (
        <div className="card" style={{ marginBottom: 18, borderColor: saveMsg.ok ? "var(--good)" : "var(--danger)" }}>
          <span style={{ color: saveMsg.ok ? "var(--good)" : "var(--danger)", fontWeight: 600, fontSize: 14 }}>
            {saveMsg.ok ? "✓ " : "⚠ "}{saveMsg.text}
          </span>
          {saveMsg.ok && (
            <a href="/stats" style={{ marginLeft: 10, color: "var(--court)", fontWeight: 600, fontSize: 14 }}>View in Stats →</a>
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Search drills</div>
        <input className="select" style={{ width: "100%", textTransform: "none" }}
          placeholder="Search by shot, skill or word — e.g. backhand, topspin, footwork, volley"
          value={query} onChange={(e) => setQuery(e.target.value)} maxLength={100} />
        {query.trim() && (
          <div className="grid grid-2" style={{ marginTop: 14 }}>
            {results.length === 0 ? (
              <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>No drills match that. Try a shot or skill word.</p>
            ) : results.map((d) => (
              <div key={d.id} className="subcard">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <strong>{d.name}</strong>
                  <span className="tag">{d.category}</span>
                </div>
                <div style={{ color: "var(--ink-soft)", fontSize: 13, margin: "5px 0 8px" }}>{d.focus}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span className="pill">{d.default_sets} × {d.default_reps}</span>
                  <span className="pill">{d.intensity}</span>
                  {user && (
                    <button className="btn btn-ghost" style={{ marginLeft: "auto", padding: "5px 12px", fontSize: 12 }}
                      onClick={() => saveDrill(d)} disabled={savedIds.has(d.id)}>
                      {savedIds.has(d.id) ? "✓ Saved" : "Save"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {workout && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>{workout.title} · {workout.total_minutes} min · {workout.level}</div>
            {user ? (
              <button className="btn btn-ghost" style={{ padding: "6px 14px", fontSize: 13 }} onClick={saveGoalWorkout} disabled={workoutSaved}>
                {workoutSaved ? "✓ Saved" : "Save workout"}
              </button>
            ) : (
              <a href="/account" style={{ fontSize: 12, color: "var(--court)", fontWeight: 600 }}>Sign in to save</a>
            )}
          </div>
          <div className="grid grid-2">
            {workout.drills.map((d) => (
              <div key={d.id} className="subcard">
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <strong>{d.name}</strong>
                  <span className="tag">{d.est_minutes}m</span>
                </div>
                <div style={{ color: "var(--ink-soft)", fontSize: 13, marginBottom: 8 }}>{d.focus}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className="pill">{d.sets} × {d.reps}</span>
                  <span className="pill">{d.intensity}</span>
                  <span className="pill">{d.category}</span>
                </div>
              </div>
            ))}
          </div>
          <p style={{ color: "var(--ink-soft)", fontSize: 13, marginTop: 14 }}>{workout.notes}</p>
        </div>
      )}

      <div className="card">
        <div className="card-title">Drill catalogue · {catalogue.length} drills</div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Drill</th><th>Category</th><th>Intensity</th><th>Default</th><th>Equipment</th></tr>
            </thead>
            <tbody>
              {catalogue.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{d.name}</div>
                    <div style={{ color: "var(--ink-soft)", fontSize: 12 }}>{d.focus}</div>
                  </td>
                  <td><span className="tag">{d.category}</span></td>
                  <td>{d.intensity}</td>
                  <td className="mono">{d.default_sets}×{d.default_reps}</td>
                  <td style={{ color: "var(--ink-soft)", fontSize: 13 }}>{d.equipment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
