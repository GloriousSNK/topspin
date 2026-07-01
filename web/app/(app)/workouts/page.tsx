"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Workout, CatalogueDrill } from "@/lib/types";

const GOALS = ["all_round", "consistency", "power", "footwork", "serve"];
const LEVELS = ["beginner", "intermediate", "advanced"];

export default function Workouts() {
  const [goal, setGoal] = useState("all_round");
  const [level, setLevel] = useState("intermediate");
  const [minutes, setMinutes] = useState(45);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [catalogue, setCatalogue] = useState<CatalogueDrill[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  return (
    <div>
      <div className="h1">Drills & Workouts</div>
      <p className="lead">
        Generate a time-boxed session from a training goal, or browse the full drill catalogue.
        Each drill is tagged with the technical flaws it targets, so sessions built from a clip
        analysis pull straight from here.
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

      {workout && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-title">{workout.title} · {workout.total_minutes} min · {workout.level}</div>
          <div className="grid grid-2">
            {workout.drills.map((d) => (
              <div key={d.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <strong>{d.name}</strong>
                  <span className="tag">{d.est_minutes}m</span>
                </div>
                <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 8 }}>{d.focus}</div>
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
        <table className="data">
          <thead>
            <tr><th>Drill</th><th>Category</th><th>Intensity</th><th>Default</th><th>Equipment</th></tr>
          </thead>
          <tbody>
            {catalogue.map((d) => (
              <tr key={d.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{d.name}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>{d.focus}</div>
                </td>
                <td><span className="tag">{d.category}</span></td>
                <td>{d.intensity}</td>
                <td className="mono">{d.default_sets}×{d.default_reps}</td>
                <td style={{ color: "var(--muted)", fontSize: 13 }}>{d.equipment}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
