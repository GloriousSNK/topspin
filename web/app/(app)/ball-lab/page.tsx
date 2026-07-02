"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { BallPrediction, LaunchInput } from "@/lib/types";

// Court dimensions (m), mirrored from the physics service.
const COURT_LEN = 23.77;
const COURT_W = 8.23;
const NET_X = 11.885;
const NET_H = 0.914;

const RPM_TO_RADS = (2 * Math.PI) / 60;

interface Controls {
  speed: number;     // m/s
  elev: number;      // launch elevation, deg
  azim: number;      // launch azimuth, deg (0 = straight down court)
  topspin: number;   // rpm (+topspin dips, -backspin floats)
  height: number;    // contact height, m
}

const DEFAULTS: Controls = { speed: 25, elev: 15, azim: 2, topspin: 2600, height: 0.9 };

function toLaunch(c: Controls): LaunchInput {
  const e = (c.elev * Math.PI) / 180;
  const a = (c.azim * Math.PI) / 180;
  const vx = c.speed * Math.cos(e) * Math.cos(a);
  const vy = c.speed * Math.cos(e) * Math.sin(a);
  const vz = c.speed * Math.sin(e);
  // Topspin: rotation about +y produces a downward Magnus force on a ball moving +x.
  const wy = c.topspin * RPM_TO_RADS;
  return { position: [0, 0, c.height], velocity: [vx, vy, vz], spin: [0, wy, 0] };
}

export default function BallLab() {
  const [c, setC] = useState<Controls>(DEFAULTS);
  const [pred, setPred] = useState<BallPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async (ctrl: Controls) => {
    setLoading(true);
    setErr(null);
    try {
      setPred(await api.predictBall(toLaunch(ctrl), 120));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run(DEFAULTS);
  }, [run]);

  const set = (k: keyof Controls) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setC((prev) => ({ ...prev, [k]: parseFloat(e.target.value) }));

  return (
    <div>
      <div className="h1">Ball Lab</div>
      <p className="lead">
        A struck ball is a nonlinear system, so tiny differences at contact grow on the way to the
        bounce. Adjust the shot, then read off the flight and how sensitive it is.
      </p>

      {err && (
        <div className="card" style={{ borderColor: "var(--danger)", marginBottom: 18 }}>
          <strong style={{ color: "var(--danger)" }}>Service error.</strong>{" "}
          <span style={{ color: "var(--muted)" }}>
            Is the ML service running on {api.base}? Start it with{" "}
            <code className="mono">uvicorn app.main:app --port 8000</code>.
          </span>
          <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>{err}</div>
        </div>
      )}

      <div className="grid stack-mobile" style={{ gridTemplateColumns: "320px 1fr", alignItems: "start" }}>
        {/* Controls */}
        <div className="card">
          <div className="card-title">Shot parameters</div>
          <Slider label="Racquet speed" val={c.speed} unit="m/s" min={10} max={45} step={0.5} onChange={set("speed")} />
          <Slider label="Launch angle" val={c.elev} unit="°" min={0} max={45} step={0.5} onChange={set("elev")} />
          <Slider label="Aim (azimuth)" val={c.azim} unit="°" min={-12} max={12} step={0.5} onChange={set("azim")} />
          <Slider label="Spin (+top / −back)" val={c.topspin} unit="rpm" min={-3000} max={5000} step={100} onChange={set("topspin")} />
          <Slider label="Contact height" val={c.height} unit="m" min={0.4} max={1.6} step={0.05} onChange={set("height")} />
          <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
            onClick={() => run(c)} disabled={loading}>
            {loading ? "Simulating…" : "Run simulation"}
          </button>
          <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
            onClick={() => { setC(DEFAULTS); run(DEFAULTS); }}>
            Reset
          </button>
        </div>

        {/* Visuals + readouts */}
        <div className="grid" style={{ gap: 18 }}>
          {pred && (
            <>
              <div className="grid grid-3">
                <Stat label="Result"
                  value={pred.landed_in ? "IN" : pred.cleared_net ? "OUT" : "NET"}
                  color={pred.landed_in ? "var(--good)" : "var(--danger)"} />
                <Stat label="Flight time" value={`${pred.flight_time_s}s`} />
                <Stat label="Apex" value={`${pred.apex_m} m`} />
                <Stat label="Impact speed" value={`${pred.impact_speed_ms} m/s`} />
                <Stat label="Spin" value={`${Math.round(pred.spin_rpm)} rpm`} />
                <Stat label="Carry"
                  value={pred.landing ? `${pred.landing[0].toFixed(1)} m` : "—"} />
              </div>

              <div className="card">
                <div className="card-title">Side view — trajectory (drag + Magnus)</div>
                <SideView pred={pred} />
              </div>

              <div className="grid grid-2">
                <div className="card">
                  <div className="card-title">Top-down — landing ensemble</div>
                  <TopDown pred={pred} />
                  {pred.ensemble && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                      <span className={`pill ${pred.ensemble.in_probability > 0.6 ? "good" : pred.ensemble.in_probability > 0.3 ? "warn" : "off"}`}>
                        {(pred.ensemble.in_probability * 100).toFixed(0)}% land in
                      </span>
                      <span className="pill">±{pred.ensemble.spread_m} m spread</span>
                    </div>
                  )}
                </div>

                <div className="card">
                  <div className="card-title">Chaos — sensitivity to contact error</div>
                  {pred.chaos && (
                    <>
                      <div className="grid grid-2" style={{ marginBottom: 12 }}>
                        <Stat label="Lyapunov λ" value={pred.chaos.lyapunov_estimate.toFixed(2)}
                          color={pred.chaos.lyapunov_estimate > 1.5 ? "var(--danger)" : "var(--court)"} />
                        <Stat label="Predict. horizon"
                          value={pred.chaos.predictability_horizon_s > 0 ? `${pred.chaos.predictability_horizon_s}s` : "∞"} />
                      </div>
                      <Divergence curve={pred.chaos.divergence_curve} />
                      <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 12, lineHeight: 1.5 }}>
                        {pred.chaos.interpretation}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- sub-components ---------------- */

function Slider(props: {
  label: string; val: number; unit: string; min: number; max: number; step: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="label" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{props.label}</span>
        <span className="field-val mono">{props.val}{props.unit}</span>
      </label>
      <input className="range" type="range" min={props.min} max={props.max} step={props.step}
        value={props.val} onChange={props.onChange} />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="stat">
        <span className="stat-value" style={{ color: color ?? "var(--text)", fontSize: 22 }}>{value}</span>
        <span className="stat-label">{label}</span>
      </div>
    </div>
  );
}

function SideView({ pred }: { pred: BallPrediction }) {
  const W = 720, H = 260, padL = 36, padB = 28, padT = 16;
  const maxX = Math.max(COURT_LEN, ...(pred.trajectory.map((p) => p.x)), 1);
  const maxZ = Math.max(2.5, pred.apex_m * 1.15);
  const sx = (x: number) => padL + (x / maxX) * (W - padL - 16);
  const sz = (z: number) => H - padB - (z / maxZ) * (H - padB - padT);

  const path = pred.trajectory.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sz(p.z).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {/* ground */}
      <line x1={padL} y1={sz(0)} x2={W - 16} y2={sz(0)} stroke="var(--ink)" strokeWidth={2} />
      {/* baseline marker */}
      <line x1={sx(COURT_LEN)} y1={sz(0) - 7} x2={sx(COURT_LEN)} y2={sz(0) + 7} stroke="var(--ink)" strokeWidth={2} />
      <text x={sx(COURT_LEN)} y={sz(0) + 20} fill="var(--ink-soft)" fontSize={10} textAnchor="middle">baseline 23.8m</text>
      {/* net */}
      <line x1={sx(NET_X)} y1={sz(0)} x2={sx(NET_X)} y2={sz(NET_H)} stroke="var(--ink)" strokeWidth={2.5} />
      <text x={sx(NET_X)} y={sz(NET_H) - 6} fill="var(--ink)" fontSize={10} fontWeight={700} textAnchor="middle">net</text>
      {/* trajectory */}
      <path d={path} fill="none" stroke="var(--court)" strokeWidth={3} strokeLinecap="round" />
      {/* landing dot */}
      {pred.landing && (
        <circle cx={sx(pred.landing[0])} cy={sz(0)} r={5}
          fill={pred.landed_in ? "var(--good)" : "var(--danger)"} />
      )}
      {/* contact dot */}
      <circle cx={sx(0)} cy={sz(pred.trajectory[0]?.z ?? 0.9)} r={4} fill="var(--text)" />
    </svg>
  );
}

function TopDown({ pred }: { pred: BallPrediction }) {
  const W = 360, H = 300, pad = 20;
  // x down court (0..COURT_LEN) maps to vertical; y lateral maps to horizontal.
  const innerW = W - pad * 2, innerH = H - pad * 2;
  const px = (y: number) => pad + ((y + COURT_W / 2) / COURT_W) * innerW;
  const py = (x: number) => pad + (x / COURT_LEN) * innerH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      <rect x={pad} y={pad} width={innerW} height={innerH} fill="var(--court)" fillOpacity={0.92}
        stroke="var(--ink)" strokeWidth={2} rx={4} />
      {/* net at mid-court */}
      <line x1={pad} y1={py(NET_X)} x2={W - pad} y2={py(NET_X)} stroke="#fff" strokeOpacity={0.9} strokeWidth={1.5} strokeDasharray="5 3" />
      {/* centre service line */}
      <line x1={W / 2} y1={pad} x2={W / 2} y2={H - pad} stroke="#fff" strokeOpacity={0.45} />
      {/* ensemble cloud */}
      {pred.ensemble?.samples.map((s, i) => (
        <circle key={i} cx={px(s[1])} cy={py(s[0])} r={2.4} fill="var(--accent)" fillOpacity={0.7} />
      ))}
      {/* mean landing */}
      {pred.ensemble && (
        <circle cx={px(pred.ensemble.mean_landing[1])} cy={py(pred.ensemble.mean_landing[0])} r={5}
          fill="none" stroke="var(--good)" strokeWidth={2} />
      )}
      {/* deterministic landing */}
      {pred.landing && (
        <circle cx={px(pred.landing[1])} cy={py(pred.landing[0])} r={4}
          fill={pred.landed_in ? "var(--good)" : "var(--danger)"} />
      )}
      <text x={W / 2} y={H - 4} fill="var(--muted)" fontSize={10} textAnchor="middle">far baseline ↑ · net ⋯</text>
    </svg>
  );
}

function Divergence({ curve }: { curve: { t: number; separation: number }[] }) {
  const W = 320, H = 120, pad = 8;
  if (!curve.length) return null;
  const maxT = Math.max(...curve.map((p) => p.t), 1e-6);
  const maxS = Math.max(...curve.map((p) => p.separation), 1e-6);
  // log-y to show exponential growth as ~straight line.
  const logS = (s: number) => Math.log10(Math.max(s, 1e-6));
  const minL = logS(1e-4), maxL = logS(maxS);
  const sx = (t: number) => pad + (t / maxT) * (W - pad * 2);
  const sy = (s: number) => H - pad - ((logS(s) - minL) / (maxL - minL + 1e-9)) * (H - pad * 2);
  const path = curve.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.t).toFixed(1)},${sy(p.separation).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      <rect x={1} y={1} width={W - 2} height={H - 2} fill="var(--paper-2)" stroke="var(--ink)" strokeWidth={2} rx={8} />
      <path d={path} fill="none" stroke="var(--danger)" strokeWidth={2.5} strokeLinecap="round" />
      <text x={W - 8} y={16} fill="var(--ink-soft)" fontSize={9} fontWeight={600} textAnchor="end">log |Δ| vs time</text>
    </svg>
  );
}
