"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Workout } from "@/lib/types";
import type { PoseAnalysis } from "@/lib/pose";
import { useAuth } from "@/components/AuthProvider";
import { saveSession, createShare } from "@/lib/history";

const STROKES = ["auto", "forehand", "backhand", "serve", "volley", "slice"];

export default function Analyze() {
  const [stroke, setStroke] = useState("auto");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [result, setResult] = useState<PoseAnalysis | null>(null);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [drag, setDrag] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user, enabled } = useAuth();

  async function handleFile(file: File) {
    setErr(null);
    setResult(null);
    setWorkout(null);
    setShareUrl(null);
    setFilename(file.name);
    try {
      setBusy("Analysing your stroke… (first run loads the model)");
      const { analyzeStroke } = await import("@/lib/pose");
      const res = await analyzeStroke(file, stroke);
      setResult(res);
      api.recordAnalysis(res.seconds, res.videoFrames); // count it (no clip leaves the device)
      if (user) saveSession(res).catch(() => {}); // save to history when signed in
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't analyse that clip.");
    } finally {
      setBusy(null);
    }
  }

  async function makeWorkout() {
    if (!result) return;
    try {
      setBusy("Building session…");
      setWorkout(await api.workoutFromFlaws(result.flaws, "intermediate", 45));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function makeShare() {
    if (!result) return;
    try {
      setBusy("Creating summary…");
      const id = await createShare({
        stroke: result.stroke, formScore: result.formScore, serveSpeedKmh: result.serveSpeedKmh,
        flaws: result.flaws, jointFeedback: result.jointFeedback, workout, createdAt: new Date().toISOString(),
      });
      if (id) setShareUrl(`${window.location.origin}/s/${id}`);
      else setErr("Couldn't create the summary. Sign in and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <span className="eyebrow">Analysis</span>
      <h1 className="h1">Clip Analysis</h1>
      <p className="lead">
        Upload a clip of one stroke. Pose detection tracks your body and checks your angles at
        contact, then turns what it finds into drills. It all runs on your device — nothing is
        uploaded, and you don&apos;t need an account.
      </p>

      <div className="card" style={{ marginBottom: 18, borderStyle: "dashed" }}>
        <div className="card-title">Filming a clip that analyses well</div>
        <div className="grid grid-2" style={{ gap: 10 }}>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8, fontSize: 14, color: "var(--ink-soft)" }}>
            <li>› <strong style={{ color: "var(--ink)" }}>Film from the side</strong>, level with you, not head-on.</li>
            <li>› <strong style={{ color: "var(--ink)" }}>Whole body in frame</strong> through the entire swing.</li>
            <li>› <strong style={{ color: "var(--ink)" }}>One stroke per clip</strong>, about 2–5 seconds.</li>
          </ul>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8, fontSize: 14, color: "var(--ink-soft)" }}>
            <li>› <strong style={{ color: "var(--ink)" }}>Good light</strong>, and a plain-ish background helps.</li>
            <li>› <strong style={{ color: "var(--ink)" }}>Steady camera</strong> — prop the phone up, don't pan.</li>
            <li>› <strong style={{ color: "var(--ink)" }}>Capture the finish</strong>, not just up to contact.</li>
          </ul>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <div>
            <label className="label" htmlFor="stroke">Stroke</label>
            <select id="stroke" value={stroke} onChange={(e) => setStroke(e.target.value)} className="select">
              {STROKES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-soft)", maxWidth: 320 }}>
            Filming a serve? Pick <strong style={{ color: "var(--ink)" }}>serve</strong> to also get an estimated speed.
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
          <div style={{ fontSize: 13, marginTop: 4 }}>mp4 / mov / webm · analysed on your device</div>
        </div>

        {busy && <div style={{ marginTop: 14, color: "var(--court)", fontWeight: 600 }}>● {busy}</div>}
        {err && <div style={{ marginTop: 14, color: "var(--danger)" }}>{err}</div>}
      </div>

      {result && (
        <>
          {user ? (
            <div style={{ marginBottom: 14, fontSize: 14, color: "var(--ink-soft)" }}>
              ✓ Saved to your history. <a href="/stats" style={{ color: "var(--court)", fontWeight: 600 }}>See your stats →</a>
            </div>
          ) : enabled ? (
            <div style={{ marginBottom: 14, fontSize: 14, color: "var(--ink-soft)" }}>
              <a href="/account" style={{ color: "var(--court)", fontWeight: 600 }}>Sign in</a> to save this and track your form over time.
            </div>
          ) : null}

          {result.serveSpeedKmh ? (
            <div className="card" style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <span style={{ fontSize: 40 }}>🎾</span>
              <div className="stat">
                <span className="stat-value" style={{ fontSize: 40, color: "var(--court)" }}>
                  ~{result.serveSpeedKmh} km/h
                </span>
                <span className="stat-label">Estimated serve speed · {Math.round(result.serveSpeedKmh * 0.621)} mph</span>
              </div>
              <span style={{ color: "var(--ink-soft)", fontSize: 12, maxWidth: 240, marginLeft: "auto" }}>
                A rough read from hand speed and body scale, not a radar gun.
              </span>
            </div>
          ) : stroke === "serve" ? null : (
            <p style={{ color: "var(--ink-soft)", fontSize: 13, marginBottom: 12 }}>
              Tip: pick <strong>serve</strong> from the dropdown before uploading to get a serve-speed estimate.
            </p>
          )}

          <div className="grid grid-2" style={{ marginBottom: 18 }}>
            <div className="card">
              <div className="card-title">What we saw</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 22, fontWeight: 700, textTransform: "capitalize" }}>{result.stroke}</span>
                <span className="pill accent">form {result.formScore}/100</span>
              </div>

              {result.flaws.length === 0 ? (
                <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>
                  Nothing major at contact. Keep grooving it and check your margin in the Ball Lab.
                </p>
              ) : (
                result.flaws.map((f) => (
                  <div key={f.id} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{f.label}</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{
                        width: `${f.severity * 100}%`,
                        background: f.severity > 0.6 ? "var(--danger)" : f.severity > 0.4 ? "var(--warn)" : "var(--accent)",
                      }} />
                    </div>
                    <div style={{ color: "var(--ink-soft)", fontSize: 13, marginTop: 5 }}>💡 {f.coaching_cue}</div>
                  </div>
                ))
              )}

              {result.flaws.length > 0 && (
                <button className="btn" style={{ marginTop: 10 }} onClick={makeWorkout} disabled={!!busy}>
                  Build a session to fix these →
                </button>
              )}
            </div>

            <div className="card">
              <div className="card-title">Your contact position</div>
              <Skeleton skeleton={result.skeleton} />
              <div className="table-wrap" style={{ marginTop: 14 }}>
                <table className="data">
                  <thead><tr><th>Check</th><th>Reading</th><th></th></tr></thead>
                  <tbody>
                    {result.jointFeedback.map((j) => (
                      <tr key={j.joint}>
                        <td>{j.joint}</td>
                        <td className="mono">{j.reading}</td>
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
              <p style={{ color: "var(--ink-soft)", fontSize: 12, marginTop: 10 }}>
                Measured from {result.framesAnalyzed} frames at your peak-swing moment.
              </p>
            </div>
          </div>

          {workout && <WorkoutCard w={workout} />}

          <div className="card" style={{ marginTop: 18 }}>
            <div className="card-title">Share with a coach</div>
            {!enabled ? (
              <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>Accounts aren&apos;t set up on this deployment yet.</p>
            ) : !user ? (
              <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>
                <a href="/account" style={{ color: "var(--court)", fontWeight: 600 }}>Sign in</a> to create a one-page summary link you can send to a coach.
              </p>
            ) : shareUrl ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input className="select" style={{ flex: 1, minWidth: 240 }} readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
                <button className="btn btn-ghost" onClick={() => { navigator.clipboard?.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                  {copied ? "Copied!" : "Copy"}
                </button>
                <a className="btn" href={shareUrl} target="_blank" rel="noreferrer">Open</a>
              </div>
            ) : (
              <button className="btn" onClick={makeShare} disabled={!!busy}>Create a shareable summary →</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Skeleton({ skeleton }: { skeleton: Record<string, [number, number]> }) {
  const W = 280, H = 260;
  const p = (name: string) => skeleton[name] ? [skeleton[name][0] * W, skeleton[name][1] * H] : null;
  const bones: [string, string][] = [
    ["left_shoulder", "right_shoulder"], ["left_shoulder", "left_elbow"], ["left_elbow", "left_wrist"],
    ["right_shoulder", "right_elbow"], ["right_elbow", "right_wrist"],
    ["left_shoulder", "left_hip"], ["right_shoulder", "right_hip"], ["left_hip", "right_hip"],
    ["left_hip", "left_knee"], ["left_knee", "left_ankle"], ["right_hip", "right_knee"], ["right_knee", "right_ankle"],
    ["nose", "left_shoulder"], ["nose", "right_shoulder"],
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 280, height: "auto", margin: "0 auto", display: "block",
      background: "var(--paper-2)", border: "1px solid rgba(29,34,27,0.35)", borderRadius: 12 }}>
      {bones.map(([a, b], i) => {
        const pa = p(a), pb = p(b);
        if (!pa || !pb) return null;
        return <line key={i} x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" />;
      })}
      {Object.keys(skeleton).map((name) => {
        const pt = p(name);
        if (!pt) return null;
        return <circle key={name} cx={pt[0]} cy={pt[1]} r={4} fill="var(--accent)" stroke="var(--ink)" strokeWidth={1.5} />;
      })}
      <text x={W / 2} y={H - 8} fill="var(--ink-soft)" fontSize={10} fontWeight={600} textAnchor="middle">your contact frame</text>
    </svg>
  );
}

function WorkoutCard({ w }: { w: Workout }) {
  return (
    <div className="card">
      <div className="card-title">{w.title} · {w.total_minutes} min · {w.level}</div>
      <div className="grid grid-2">
        {w.drills.map((d) => (
          <div key={d.id} className="subcard">
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
