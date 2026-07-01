"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ClipAnalysis, Workout } from "@/lib/types";

const STROKES = ["auto", "forehand", "backhand", "serve", "volley", "slice"];

export default function Analyze() {
  const [stroke, setStroke] = useState("auto");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [result, setResult] = useState<ClipAnalysis | null>(null);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setErr(null);
    setResult(null);
    setWorkout(null);
    setFilename(file.name);
    try {
      setBusy("Uploading clip…");
      const up = await api.uploadClip(file, stroke === "auto" ? undefined : stroke);
      setBusy("Running V-JEPA stroke analysis…");
      const analysis = await api.analyzeClip(up.clip_id, 2.0, stroke === "auto" ? undefined : stroke);
      setResult(analysis);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function makeWorkout() {
    if (!result) return;
    try {
      setBusy("Building session…");
      setWorkout(await api.workoutFromFlaws(result.analysis.flaws, "intermediate", 45));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="h1">Clip Analysis</div>
      <p className="lead">
        Upload a short clip of a single stroke. The V-JEPA video model identifies the stroke,
        segments it into phases, and flags technical flaws — then pose estimation compares your
        joint angles to an ideal reference.
      </p>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <div>
            <label className="label">Stroke hint</label>
            <select value={stroke} onChange={(e) => setStroke(e.target.value)}
              style={{ background: "var(--panel-2)", color: "var(--text)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "8px 12px", fontSize: 14 }}>
              {STROKES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div
          className={`dropzone ${drag ? "drag" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault(); setDrag(false);
            if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
          }}
        >
          <input ref={inputRef} type="file" accept="video/*" hidden
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <div style={{ fontSize: 28, marginBottom: 8 }}>▣</div>
          <div style={{ fontWeight: 600, color: "var(--text)" }}>
            {filename ?? "Drop a clip here, or click to browse"}
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>mp4 / mov / webm · up to 100 MB</div>
        </div>

        {busy && <div style={{ marginTop: 14, color: "var(--court)", fontWeight: 600 }}>● {busy}</div>}
        {err && (
          <div style={{ marginTop: 14, color: "var(--danger)" }}>
            {err}
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
              Make sure the ML service is running at {api.base}.
            </div>
          </div>
        )}
      </div>

      {result && (
        <>
          <div className="grid grid-2" style={{ marginBottom: 18 }}>
            {/* Stroke + flaws */}
            <div className="card">
              <div className="card-title">Stroke analysis</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 700, textTransform: "capitalize" }}>
                  {result.analysis.stroke}
                </span>
                <span className="pill accent">{(result.analysis.stroke_confidence * 100).toFixed(0)}% conf</span>
              </div>
              <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16 }}>{result.analysis.summary}</p>

              <PhaseBar phases={result.analysis.phases} />

              <div style={{ marginTop: 18 }}>
                {result.analysis.flaws.map((f) => (
                  <div key={f.id} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{f.label}</span>
                      <span className="tag">{f.phase.replace("_", " ")}</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{
                        width: `${f.severity * 100}%`,
                        background: f.severity > 0.6 ? "var(--danger)" : f.severity > 0.4 ? "var(--warn)" : "var(--accent)",
                      }} />
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 5 }}>
                      💡 {f.coaching_cue}
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn" style={{ marginTop: 10 }} onClick={makeWorkout} disabled={!!busy}>
                Generate a session to fix these →
              </button>
            </div>

            {/* Pose / form */}
            <div className="card">
              <div className="card-title">Form vs ideal · score {result.pose.form_score}/100</div>
              <Skeleton pose={result.pose} />
              <table className="data" style={{ marginTop: 14 }}>
                <thead>
                  <tr><th>Joint</th><th>You</th><th>Ideal</th><th>Δ</th><th></th></tr>
                </thead>
                <tbody>
                  {result.pose.joint_feedback.map((j) => (
                    <tr key={j.joint}>
                      <td style={{ textTransform: "capitalize" }}>{j.joint.replace("_", " ")}</td>
                      <td className="mono">{j.user_angle}°</td>
                      <td className="mono" style={{ color: "var(--muted)" }}>{j.ideal_angle}°</td>
                      <td className="mono">{j.deviation > 0 ? "+" : ""}{j.deviation}°</td>
                      <td>
                        <span className={`pill ${j.status === "good" ? "good" : j.status === "minor" ? "warn" : "off"}`}>
                          {j.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {workout && <WorkoutCard w={workout} />}
        </>
      )}
    </div>
  );
}

function PhaseBar({ phases }: { phases: { phase: string; start: number; end: number }[] }) {
  const total = phases[phases.length - 1]?.end || 1;
  const colors = ["var(--good)", "var(--accent)", "var(--court)", "var(--warn)", "var(--danger)"];
  const lightText = new Set([0, 2, 4]); // green / blue / clay need light label text
  return (
    <div>
      <div style={{ display: "flex", height: 28, borderRadius: 8, overflow: "hidden", border: "2px solid var(--ink)" }}>
        {phases.map((p, i) => (
          <div key={p.phase} title={`${p.phase} ${p.start}-${p.end}s`}
            style={{ width: `${((p.end - p.start) / total) * 100}%`, background: colors[i % colors.length],
              borderRight: i < phases.length - 1 ? "2px solid var(--ink)" : "none",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 9, color: lightText.has(i % colors.length) ? "#fff" : "var(--ink)", fontWeight: 800, textTransform: "uppercase",
              whiteSpace: "nowrap", overflow: "hidden" }}>{p.phase[0]}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
        <span>preparation → recovery</span><span className="mono">{total.toFixed(1)}s</span>
      </div>
    </div>
  );
}

function Skeleton({ pose }: { pose: ClipAnalysis["pose"] }) {
  const W = 280, H = 260;
  const kp = pose.reference_skeleton;
  const p = (name: string) => kp[name] ? [kp[name][0] * W, kp[name][1] * H] : null;
  const bones: [string, string][] = [
    ["left_shoulder", "right_shoulder"], ["left_shoulder", "left_elbow"], ["left_elbow", "left_wrist"],
    ["right_shoulder", "right_elbow"], ["right_elbow", "right_wrist"],
    ["left_shoulder", "left_hip"], ["right_shoulder", "right_hip"], ["left_hip", "right_hip"],
    ["left_hip", "left_knee"], ["left_knee", "left_ankle"], ["right_hip", "right_knee"], ["right_knee", "right_ankle"],
    ["nose", "left_shoulder"], ["nose", "right_shoulder"],
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 280, height: "auto", margin: "0 auto", display: "block",
      background: "var(--paper-2)", border: "2px solid var(--ink)", borderRadius: 12 }}>
      {bones.map(([a, b], i) => {
        const pa = p(a), pb = p(b);
        if (!pa || !pb) return null;
        return <line key={i} x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" />;
      })}
      {Object.keys(kp).map((name) => {
        const pt = p(name);
        if (!pt) return null;
        return <circle key={name} cx={pt[0]} cy={pt[1]} r={4} fill="var(--accent)" stroke="var(--ink)" strokeWidth={1.5} />;
      })}
      <text x={W / 2} y={H - 8} fill="var(--ink-soft)" fontSize={10} fontWeight={600} textAnchor="middle">ideal reference · contact frame</text>
    </svg>
  );
}

function WorkoutCard({ w }: { w: Workout }) {
  return (
    <div className="card">
      <div className="card-title">{w.title} · {w.total_minutes} min · {w.level}</div>
      <div className="grid grid-2">
        {w.drills.map((d) => (
          <div key={d.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <strong>{d.name}</strong>
              <span className="tag">{d.est_minutes}m</span>
            </div>
            <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 8 }}>{d.focus}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="pill">{d.sets} × {d.reps}</span>
              <span className="pill">{d.intensity}</span>
              {d.targets.map((t) => <span key={t} className="pill accent">{t}</span>)}
            </div>
          </div>
        ))}
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 14 }}>{w.notes}</p>
    </div>
  );
}
