"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Workout, CatalogueDrill, GeneratedDrill } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { saveCustomDrill } from "@/lib/history";

const GOALS = ["all_round", "consistency", "power", "footwork", "serve", "volley"];
const LEVELS = ["beginner", "intermediate", "advanced"];

export default function Workouts() {
  const { user } = useAuth();
  const [goal, setGoal] = useState("all_round");
  const [level, setLevel] = useState("intermediate");
  const [minutes, setMinutes] = useState(45);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [catalogue, setCatalogue] = useState<CatalogueDrill[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // dynamic (goal → generated drill)
  const [goalText, setGoalText] = useState("");
  const [gen, setGen] = useState<GeneratedDrill | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.catalogue().then((r) => setCatalogue(r.drills)).catch((e) => setErr(String(e)));
  }, []);

  async function generate() {
    setBusy(true); setErr(null);
    try {
      setWorkout(await api.workoutByGoal(goal, level, minutes));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function generateDynamic(e: React.FormEvent) {
    e.preventDefault();
    if (!goalText.trim()) return;
    setGenBusy(true); setErr(null); setSaved(false);
    try {
      setGen(await api.generateDrill(goalText.trim()));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setGenBusy(false);
    }
  }

  async function saveGen() {
    if (!gen) return;
    const ok = await saveCustomDrill(gen);
    setSaved(ok);
  }

  return (
    <div>
      <span className="eyebrow">Practice</span>
      <div className="h1">Drills & Workouts</div>
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

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Describe your goal · get a drill</div>
        <form onSubmit={generateDynamic} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input className="select" style={{ flex: 1, minWidth: 240, textTransform: "none" }}
            placeholder="e.g. more topspin on my backhand, or a faster serve"
            value={goalText} onChange={(e) => setGoalText(e.target.value)} maxLength={200} />
          <button className="btn" disabled={genBusy}>{genBusy ? "Thinking…" : "Generate a drill"}</button>
        </form>

        {gen && (
          <div className="subcard" style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <strong style={{ fontSize: 16 }}>{gen.name}</strong>
              <div style={{ display: "flex", gap: 6 }}>
                <span className="pill">{gen.sets} × {gen.reps}</span>
                <span className="pill">{gen.intensity}</span>
              </div>
            </div>
            {gen.focus && <p style={{ color: "var(--ink-soft)", fontSize: 14, margin: "6px 0 10px" }}>{gen.focus}</p>}
            <ol style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
              {gen.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
            <div style={{ marginTop: 12 }}>
              {user ? (
                <button className="btn btn-ghost" onClick={saveGen} disabled={saved}>
                  {saved ? "✓ Saved to your account" : "Save this drill"}
                </button>
              ) : (
                <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                  <a href="/account" style={{ color: "var(--court)", fontWeight: 600 }}>Sign in</a> to save drills to your account.
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {workout && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-title">{workout.title} · {workout.total_minutes} min · {workout.level}</div>
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
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 14 }}>{workout.notes}</p>
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
