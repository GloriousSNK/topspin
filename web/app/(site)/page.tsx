import Link from "next/link";
import type { Metadata } from "next";
import HeroTilt from "@/components/HeroTilt";

export const metadata: Metadata = {
  title: "TopSpin — AI Tennis Practice Lab",
  description:
    "Upload a clip, get your stroke analysed by in-browser pose detection, turn flaws into a " +
    "targeted session, and predict ball flight with real drag + Magnus physics and chaos analysis.",
};

const TECH = ["Video stroke analysis", "Pose tracking", "Real flight physics", "Spin & drag", "Chaos analysis", "Runs locally"];

export default function Landing() {
  return (
    <>
      {/* ---------------- HERO ---------------- */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <h1>
              Stop guessing. <span className="mark">Start</span> improving.
            </h1>
            <p>
              Film one stroke. TopSpin shows you what&apos;s actually holding you back, builds a
              session to fix it, and lets you play with the physics of your own shots.
            </p>
            <div className="hero-cta">
              <Link href="/analyze" className="btn btn-lg">Analyse my stroke</Link>
              <Link href="/ball-lab" className="btn btn-ghost btn-lg">Open the Ball Lab</Link>
            </div>
            <p style={{ marginTop: 18, fontSize: 13, color: "var(--ink-soft)", fontWeight: 500 }}>
              Clips are analysed on your device, never uploaded. No sign-up needed to try it.
            </p>
          </div>
          <HeroTilt>
            {/* parallax layer: floats above the card as it tilts */}
            <div className="parallax-layer" style={{ position: "absolute", top: -30, right: -16, zIndex: 3, transform: "translateZ(60px)" }}>
              <div className="ball3d float-slow">
                <div className="core" />
                <div className="glow" />
              </div>
            </div>
            <div className="hero-visual" style={{ transform: "translateZ(20px)" }}>
              <HeroCourt />
              <div className="cap">
                <span>Predicted flight · landing ensemble</span>
                <span className="mono">in 94% · λ 4.2</span>
              </div>
            </div>
          </HeroTilt>
        </div>
      </section>

      {/* ---------------- TECH STRIP ---------------- */}
      <section className="section tight" style={{ background: "var(--card)" }}>
        <div className="container">
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-soft)" }}>
              What&apos;s inside
            </span>
            {TECH.map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- FEATURES ---------------- */}
      <section id="features" className="section">
        <div className="container">
          <span className="eyebrow">What you get</span>
          <h2 className="section-title">Four tools, one straight line to a better stroke.</h2>
          <p className="section-lead">
            Everything connects. Your clip becomes a session, and the Ball Lab helps you understand
            why a shot lands in or sails long. No filler, no vanity stats.
          </p>

          <FeatureRow
            tag="Clip Analysis"
            title="See your stroke the way a coach does"
            body="Pose detection tracks your body through the swing and checks your angles at contact, then tells you what's off in plain language. Real feedback from your own clip, not generic tips."
            points={["Runs right on your device", "Real joint angles at contact", "Flaws tied to what you did"]}
            media={<MiniPhases />}
          />
          <FeatureRow
            rev
            tag="Form Comparison"
            title="Line your form up against the target"
            body="Your contact position gets measured against target angles for the arm, knees and trunk, so you know exactly what to adjust instead of guessing from a slow-mo replay."
            points={["Per-joint difference from target", "A single 0–100 form score", "Your real contact frame, drawn out"]}
            media={<MiniSkeleton />}
          />
          <FeatureRow
            tag="Drills & Workouts"
            title="Turn those flaws into a real session"
            body="Your biggest weaknesses become the first drills in a session that fits the time you've got. No clip handy? Pick a goal like consistency or power and we'll build one anyway."
            points={["Worst flaws get worked first", "Sets, reps and a time budget", "Goal-based workouts too"]}
            media={<MiniDrills />}
          />
          <FeatureRow
            rev
            tag="Ball Lab"
            title="See where the ball really goes"
            body="Set the speed, spin and angle, and watch the flight with drag and spin included, not a smooth parabola. Then see how forgiving that shot actually is before you try it for real."
            points={["Real drag + spin (Magnus) flight", "How sensitive the shot is to small errors", "Landing spread and in/out odds"]}
            media={<MiniTrajectory />}
          />
        </div>
      </section>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section id="how" className="section" style={{ background: "var(--card)" }}>
        <div className="container">
          <span className="eyebrow">The loop</span>
          <h2 className="section-title">From clip to clear next step in four moves.</h2>
          <p className="section-lead">Run it after every hitting session. It takes a couple of minutes and you always leave knowing what to work on next.</p>
          <div className="steps">
            {[
              { n: 1, t: "Record", d: "Film one stroke on your phone and drop the clip into the app." },
              { n: 2, t: "Analyse", d: "The model breaks down the stroke and surfaces your top flaws." },
              { n: 3, t: "Train", d: "Get a prioritised session built around exactly those flaws." },
              { n: 4, t: "Predict", d: "Use the Ball Lab to dial in spin, angle and margin." },
            ].map((s) => (
              <div key={s.n} className="card lift">
                <span className="step-num">{s.n}</span>
                <h3 style={{ fontSize: 18, fontWeight: 750, marginBottom: 6 }}>{s.t}</h3>
                <p style={{ color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.55 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- PHYSICS ---------------- */}
      <section id="physics" className="section">
        <div className="container">
          <div className="hero-grid">
            <div>
              <span className="eyebrow">What&apos;s under the hood</span>
              <h2 className="section-title">A struck ball is a tiny chaotic system. We treat it like one.</h2>
              <p className="section-lead">
                Once it leaves the strings the ball feels gravity, drag, and the Magnus force from
                spin. Drag grows with the square of speed and spin keeps bending the flight, so
                there&apos;s no neat formula for where it lands. You have to march the motion forward
                in tiny steps, and because it&apos;s nonlinear, two almost-identical contacts can
                finish a metre apart.
              </p>
              <ul className="feature-text" style={{ marginTop: 8 }}>
                <li>We simulate the real flight, spin and air included, instead of drawing a smooth arc</li>
                <li>We measure how twitchy the shot is, so you know how much margin you&apos;re playing with</li>
                <li>And we fly it 200 times with small variations to get honest odds of landing in</li>
              </ul>
              <Link href="/learn" className="btn btn-ghost" style={{ marginTop: 24 }}>See how it works →</Link>
            </div>
            <div className="feature-media" style={{ background: "#1f1d15", borderColor: "var(--ink)" }}>
              <MiniDivergence />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- ABOUT TEASER ---------------- */}
      <section id="about" className="section" style={{ background: "var(--card)" }}>
        <div className="container stack-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "center" }}>
          <div>
            <span className="eyebrow">Why we built it</span>
            <h2 className="section-title">Most apps count your reps. We tell you which reps to do.</h2>
            <p className="section-lead" style={{ marginBottom: 22 }}>
              It&apos;s for players who&apos;d rather fix the real problem than grind the same drills
              on repeat. We&apos;d rather hand you one thing worth changing than a wall of numbers.
            </p>
            <Link href="/about" className="btn">Read the full story →</Link>
          </div>
          <div className="grid grid-2">
            <div className="card lift"><div className="stat"><span className="stat-value" style={{ color: "var(--court)" }}>RK4</span><span className="stat-label">Real integrator</span></div></div>
            <div className="card lift"><div className="stat"><span className="stat-value">~0.7s</span><span className="stat-label">Full prediction</span></div></div>
            <div className="card lift"><div className="stat"><span className="stat-value">34</span><span className="stat-label">Drills & growing</span></div></div>
            <div className="card lift"><div className="stat"><span className="stat-value">100%</span><span className="stat-label">Runs locally</span></div></div>
          </div>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="section section-ink cta-band">
        <div className="container">
          <h2>Curious what your forehand is hiding?</h2>
          <p>Drop in a clip and see it broken down in a few seconds.</p>
          <Link href="/analyze" className="btn btn-lg">Analyse my stroke</Link>
        </div>
      </section>
    </>
  );
}

/* ============================================================
   Reusable bits
   ============================================================ */
function FeatureRow({ tag, title, body, points, media, rev }: {
  tag: string; title: string; body: string; points: string[]; media: React.ReactNode; rev?: boolean;
}) {
  return (
    <div className={`feature-row${rev ? " rev" : ""}`}>
      <div className="feature-text">
        <span className="tag" style={{ marginBottom: 12, display: "inline-block" }}>{tag}</span>
        <h3>{title}</h3>
        <p>{body}</p>
        <ul>{points.map((p) => <li key={p}>{p}</li>)}</ul>
      </div>
      <div className="feature-media">{media}</div>
    </div>
  );
}

/* ---- Hero court visual (top-down) ---- */
function HeroCourt() {
  const W = 480, H = 340, pad = 26;
  const iw = W - pad * 2, ih = H - pad * 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <rect x={0} y={0} width={W} height={H} fill="var(--card)" />
      {/* court */}
      <rect x={pad} y={pad} width={iw} height={ih} fill="var(--court)" stroke="var(--ink)" strokeWidth={2.5} rx={5} />
      {/* lines */}
      <line x1={pad} y1={H / 2} x2={W - pad} y2={H / 2} stroke="#fff" strokeWidth={2} strokeDasharray="6 4" opacity={0.9} />
      <line x1={W / 2} y1={pad} x2={W / 2} y2={H - pad} stroke="#fff" opacity={0.4} />
      <line x1={pad + 34} y1={pad} x2={pad + 34} y2={H - pad} stroke="#fff" opacity={0.3} />
      <line x1={W - pad - 34} y1={pad} x2={W - pad - 34} y2={H - pad} stroke="#fff" opacity={0.3} />
      {/* trajectory arc from near baseline to landing zone */}
      <path d={`M ${W / 2} ${H - pad - 6} C ${W * 0.36} ${H * 0.5}, ${W * 0.6} ${H * 0.34}, ${W * 0.66} ${pad + 54}`}
        fill="none" stroke="var(--ink)" strokeWidth={3} strokeDasharray="2 7" strokeLinecap="round" />
      {/* ball mid-flight */}
      <circle cx={W * 0.49} cy={H * 0.46} r={7} fill="var(--accent)" stroke="var(--ink)" strokeWidth={2} />
      {/* landing ensemble */}
      {ensemblePts.map((p, i) => (
        <circle key={i} cx={W * 0.66 + p[0]} cy={pad + 54 + p[1]} r={2.6} fill="var(--accent)" stroke="var(--ink)" strokeWidth={0.6} />
      ))}
      <circle cx={W * 0.66} cy={pad + 54} r={16} fill="none" stroke="var(--good)" strokeWidth={2.5} />
    </svg>
  );
}
const ensemblePts: [number, number][] = [
  [0, 0], [6, -4], [-7, 3], [4, 7], [-5, -6], [10, 2], [-11, -2], [2, -10],
  [8, -8], [-4, 9], [12, -5], [-9, 6], [3, 4], [-2, -3], [7, 9],
];

/* ---- Mini phase bar ---- */
function MiniPhases() {
  const segs = [
    { w: 18, c: "var(--good)", l: "P" }, { w: 22, c: "var(--accent)", l: "B" },
    { w: 12, c: "var(--court)", l: "C" }, { w: 30, c: "var(--warn)", l: "F" },
    { w: 18, c: "var(--danger)", l: "R" },
  ];
  const flaws = [{ n: "Late preparation", v: 72 }, { n: "Dropped elbow", v: 54 }, { n: "Narrow base", v: 38 }];
  return (
    <div>
      <div style={{ display: "flex", height: 30, border: "2px solid var(--ink)", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
        {segs.map((s, i) => (
          <div key={i} style={{ width: `${s.w}%`, background: s.c, borderRight: i < segs.length - 1 ? "2px solid var(--ink)" : "none",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800,
            color: i === 1 || i === 3 ? "var(--ink)" : "#fff" }}>{s.l}</div>
        ))}
      </div>
      {flaws.map((f) => (
        <div key={f.n} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            <span>{f.n}</span><span className="mono" style={{ color: "var(--ink-soft)" }}>{f.v}%</span>
          </div>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${f.v}%`, background: f.v > 60 ? "var(--danger)" : f.v > 45 ? "var(--warn)" : "var(--accent)" }} /></div>
        </div>
      ))}
    </div>
  );
}

/* ---- Mini skeleton ---- */
function MiniSkeleton() {
  const W = 220, H = 200;
  const kp: Record<string, [number, number]> = {
    nose: [0.52, 0.16], ls: [0.44, 0.30], rs: [0.60, 0.30], le: [0.36, 0.44], re: [0.74, 0.34],
    lw: [0.42, 0.56], rw: [0.86, 0.30], lh: [0.47, 0.58], rh: [0.58, 0.58],
    lk: [0.45, 0.78], rk: [0.62, 0.78], la: [0.44, 0.96], ra: [0.65, 0.96],
  };
  const bones = [["ls", "rs"], ["ls", "le"], ["le", "lw"], ["rs", "re"], ["re", "rw"], ["ls", "lh"], ["rs", "rh"],
    ["lh", "rh"], ["lh", "lk"], ["lk", "la"], ["rh", "rk"], ["rk", "ra"], ["nose", "ls"], ["nose", "rs"]];
  const P = (k: string) => [kp[k][0] * W, kp[k][1] * H];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 220, margin: "0 auto", display: "block" }}>
      {bones.map(([a, b], i) => {
        const pa = P(a), pb = P(b);
        return <line key={i} x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" />;
      })}
      {Object.keys(kp).map((k) => { const p = P(k); return <circle key={k} cx={p[0]} cy={p[1]} r={4} fill="var(--accent)" stroke="var(--ink)" strokeWidth={1.5} />; })}
      {/* highlight the elbow deviation */}
      <circle cx={kp.re[0] * W} cy={kp.re[1] * H} r={11} fill="none" stroke="var(--danger)" strokeWidth={2.5} />
    </svg>
  );
}

/* ---- Mini drills ---- */
function MiniDrills() {
  const drills = [
    { n: "Shadow unit-turn timing", s: "3 × 12", m: 6 },
    { n: "Elbow-up wall rally", s: "4 × 20", m: 9 },
    { n: "Front-foot loading step-in", s: "3 × 15", m: 9 },
  ];
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontWeight: 700 }}>Personalised session</span>
        <span className="pill accent">24 min</span>
      </div>
      {drills.map((d) => (
        <div key={d.n} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          border: "2px solid var(--ink)", borderRadius: 10, padding: "10px 12px", marginBottom: 8, background: "var(--paper)" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{d.n}</span>
          <span className="mono" style={{ fontSize: 12, color: "var(--ink-soft)" }}>{d.s} · {d.m}m</span>
        </div>
      ))}
    </div>
  );
}

/* ---- Mini trajectory (side view) ---- */
function MiniTrajectory() {
  const W = 300, H = 170, padL = 10, padB = 18;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const x = i / 40;
    const z = Math.sin(x * Math.PI) * (1 - x * 0.25); // arc, slightly front-loaded
    pts.push([padL + x * (W - padL - 6), H - padB - z * (H - padB - 14)]);
  }
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <line x1={padL} y1={H - padB} x2={W - 6} y2={H - padB} stroke="var(--ink)" strokeWidth={2} />
      <line x1={W * 0.5} y1={H - padB} x2={W * 0.5} y2={H - padB - 26} stroke="var(--ink)" strokeWidth={2.5} />
      <text x={W * 0.5} y={H - padB - 30} fontSize={9} fontWeight={700} textAnchor="middle" fill="var(--ink)">net</text>
      <path d={d} fill="none" stroke="var(--court)" strokeWidth={3} strokeLinecap="round" />
      <circle cx={pts[40][0]} cy={pts[40][1]} r={5} fill="var(--good)" stroke="var(--ink)" strokeWidth={1.5} />
      <circle cx={pts[0][0]} cy={pts[0][1]} r={4} fill="var(--ink)" />
    </svg>
  );
}

/* ---- Mini divergence (for physics section, on dark) ---- */
function MiniDivergence() {
  const W = 320, H = 200, pad = 18;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const sep = Math.pow(10, -3 + t * 3.2); // exponential growth
    const y = H - pad - ((Math.log10(sep) + 3) / 3.2) * (H - pad * 2);
    pts.push([pad + t * (W - pad * 2), y]);
  }
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {[0, 1, 2, 3].map((g) => (
        <line key={g} x1={pad} y1={pad + (g / 3) * (H - pad * 2)} x2={W - pad} y2={pad + (g / 3) * (H - pad * 2)}
          stroke="#3a372b" strokeWidth={1} />
      ))}
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" />
      <text x={W - pad} y={pad + 4} fontSize={10} fontWeight={700} textAnchor="end" fill="#c8c3b0">log |Δ| — exponential divergence</text>
      <circle cx={pts[40][0]} cy={pts[40][1]} r={5} fill="var(--danger)" />
    </svg>
  );
}
