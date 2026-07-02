import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learn — The physics behind TopSpin",
  description:
    "Plain-English walkthrough of the forces on a tennis ball, why flight has to be simulated, " +
    "and what chaos, Lyapunov exponents and the landing ensemble actually mean.",
};

export default function Learn() {
  return (
    <>
      <section className="section" style={{ paddingTop: 60 }}>
        <div className="container" style={{ maxWidth: 820 }}>
          <span className="eyebrow">Learn</span>
          <h1 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "clamp(34px,5vw,48px)", fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.06, marginBottom: 18 }}>
            The physics behind the Ball Lab
          </h1>
          <p style={{ fontSize: 18, color: "var(--ink-soft)", lineHeight: 1.65 }}>
            You don&apos;t need any of this to use TopSpin. But if you&apos;ve ever wondered why a
            ball that felt identical landed two feet shorter, this is the honest answer. No heavy
            maths — just what&apos;s actually happening between the strings and the bounce.
          </p>
        </div>
      </section>

      {/* THREE FORCES */}
      <section className="section" style={{ background: "var(--card)" }}>
        <div className="container">
          <div className="hero-grid">
            <div>
              <span className="eyebrow">Step 1 · The forces</span>
              <h2 className="section-title">Three forces, fighting the whole way</h2>
              <p style={{ color: "var(--ink-soft)", fontSize: 16, lineHeight: 1.65, marginBottom: 18 }}>
                The moment the ball leaves your strings, only three things act on it:
              </p>
              <ul className="feature-text">
                <li><b>Gravity</b> pulls straight down. Constant, boring, predictable.</li>
                <li><b>Drag</b> is the air resisting the ball, pointing back along its path. It scales with the <i>square</i> of speed, so a fast ball is punished far harder than a slow one.</li>
                <li><b>The Magnus force</b> comes from spin. A spinning ball drags air around with it, and that pushes it sideways — down for topspin, up for backspin.</li>
              </ul>
              <p style={{ color: "var(--ink-soft)", fontSize: 15, lineHeight: 1.7, marginTop: 18 }}>
                The thing worth remembering: drag is all about speed, and Magnus is all about spin.
                Hit the ball harder and the air fights back a lot more. Put more spin on it and it
                curves and dips that much sooner. Those are the two dials you&apos;re really turning on
                every shot.
              </p>
            </div>
            <div className="feature-media">
              <ForcesDiagram />
            </div>
          </div>
        </div>
      </section>

      {/* WHY SIMULATE */}
      <section className="section">
        <div className="container" style={{ maxWidth: 860 }}>
          <span className="eyebrow">Step 2 · Why there&apos;s no formula</span>
          <h2 className="section-title">You can&apos;t just solve it — you have to march it forward</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 16, lineHeight: 1.7 }}>
            In school you get the clean parabola for a thrown object. That only works because it
            ignores air. Add drag (which depends on speed) and Magnus (which depends on speed and
            direction), and the equation now depends on its own answer. There&apos;s no tidy formula
            left.
          </p>
          <p style={{ color: "var(--ink-soft)", fontSize: 16, lineHeight: 1.7, marginTop: 14 }}>
            So we do it the patient way instead: take a tiny step in time, work out the forces right
            now, nudge the ball along, and repeat a few hundred times until it bounces. Step carefully
            enough and the simulated flight tracks the real one almost perfectly. (If you like names,
            the stepping method is called RK4 — the same one used to plot planetary orbits.)
          </p>
        </div>
      </section>

      {/* CHAOS */}
      <section className="section" style={{ background: "var(--card)" }}>
        <div className="container">
          <div className="hero-grid">
            <div>
              <span className="eyebrow">Step 3 · The chaos part</span>
              <h2 className="section-title">Tiny errors don&apos;t stay tiny</h2>
              <p className="section-lead">
                Because those forces feed back on themselves, the system is <b>chaotic</b>: change the
                launch by a hair and the difference doesn&apos;t stay a hair — it grows, roughly
                doubling and doubling again as the ball flies.
              </p>
              <p className="section-lead">
                There&apos;s even a single number for how fast it happens — the Ball Lab labels it λ.
                A bigger λ means a twitchier, less forgiving shot; a smaller one means you&apos;ve got
                room to spare. A flat drive aimed at the lines runs hot. A loopy topspin ball with
                plenty of net clearance stays calm.
              </p>
              <p className="section-lead" style={{ marginBottom: 0 }}>
                That&apos;s what the divergence chart in the Ball Lab shows: two near-identical shots
                pulling apart, plotted on a log scale so the exponential growth reads as a straight
                climb.
              </p>
            </div>
            <div className="feature-media" style={{ background: "#1f1d15", borderColor: "var(--ink)" }}>
              <DivergenceViz />
            </div>
          </div>
        </div>
      </section>

      {/* ENSEMBLE */}
      <section className="section">
        <div className="container" style={{ maxWidth: 860 }}>
          <span className="eyebrow">Step 4 · From one shot to a probability</span>
          <h2 className="section-title">Why we forecast a cloud, not a point</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 16, lineHeight: 1.7 }}>
            If a real swing is never exactly repeatable, a single predicted landing spot is a bit of a
            lie. So we do what weather forecasters do: take the shot, jitter the contact 200 times by
            a realistic amount — a little speed, a little angle, a little spin — and fly every version.
          </p>
          <p style={{ color: "var(--ink-soft)", fontSize: 16, lineHeight: 1.7, marginTop: 14 }}>
            The spread of where they land is your margin, and the fraction that stay in is a real
            in/out probability. A shot that&apos;s &quot;in&quot; on paper but only lands in 60% of the
            time is telling you something a single trajectory never could.
          </p>
        </div>
      </section>

      {/* AI SIDE */}
      <section className="section" style={{ background: "var(--card)" }}>
        <div className="container" style={{ maxWidth: 860 }}>
          <span className="eyebrow">The other half</span>
          <h2 className="section-title">And the video side?</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 16, lineHeight: 1.7 }}>
            The physics is one half of TopSpin; reading your stroke is the other. A pose model finds
            your body&apos;s joints in each frame of your clip, right in the browser. From those we
            pick the contact moment, measure your angles, and compare them to sensible targets.
          </p>
          <p style={{ color: "var(--ink-soft)", fontSize: 16, lineHeight: 1.7, marginTop: 14 }}>
            It runs on your device, so your clip never leaves your machine. More on the{" "}
            <Link href="/about" style={{ color: "var(--court)", fontWeight: 600 }}>about page</Link>.
          </p>
        </div>
      </section>

      <section className="section cta-band">
        <div className="container">
          <h2 style={{ fontSize: 34 }}>Go play with it.</h2>
          <p>The Ball Lab turns all of this into sliders. Move one and watch the landing cloud shift.</p>
          <Link href="/ball-lab" className="btn btn-lg">Open the Ball Lab</Link>
        </div>
      </section>
    </>
  );
}

/* ---- Forces free-body diagram ---- */
function ForcesDiagram() {
  const cx = 150, cy = 150;
  return (
    <svg viewBox="0 0 300 300" style={{ width: "100%", height: "auto", display: "block" }}>
      {/* velocity direction (up-right) */}
      <Arrow x1={cx} y1={cy} x2={cx + 78} y2={cy - 78} color="var(--ink-soft)" label="v" lx={cx + 86} ly={cy - 82} dash />
      {/* gravity down */}
      <Arrow x1={cx} y1={cy} x2={cx} y2={cy + 86} color="var(--court)" label="gravity" lx={cx + 4} ly={cy + 100} />
      {/* drag opposing velocity (down-left) */}
      <Arrow x1={cx} y1={cy} x2={cx - 66} y2={cy + 66} color="var(--danger)" label="drag" lx={cx - 92} ly={cy + 78} />
      {/* magnus perpendicular (down-right for topspin) */}
      <Arrow x1={cx} y1={cy} x2={cx + 62} y2={cy + 62} color="var(--accent-dim)" label="Magnus" lx={cx + 66} ly={cy + 80} />
      {/* ball */}
      <circle cx={cx} cy={cy} r={16} fill="var(--accent)" stroke="var(--ink)" strokeWidth={2.5} />
      <path d={`M ${cx - 14} ${cy - 7} Q ${cx} ${cy + 4} ${cx + 14} ${cy - 7}`} fill="none" stroke="var(--ink)" strokeWidth={1.5} />
    </svg>
  );
}

function Arrow({ x1, y1, x2, y2, color, label, lx, ly, dash }: {
  x1: number; y1: number; x2: number; y2: number; color: string; label: string; lx: number; ly: number; dash?: boolean;
}) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const a1 = ang + Math.PI - 0.4, a2 = ang + Math.PI + 0.4;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={3} strokeDasharray={dash ? "4 4" : "0"} strokeLinecap="round" />
      {!dash && (
        <polygon points={`${x2},${y2} ${x2 + 11 * Math.cos(a1)},${y2 + 11 * Math.sin(a1)} ${x2 + 11 * Math.cos(a2)},${y2 + 11 * Math.sin(a2)}`} fill={color} />
      )}
      <text x={lx} y={ly} fontSize={12} fontWeight={700} fill={color} textAnchor="middle">{label}</text>
    </g>
  );
}

/* ---- Divergence viz (dark) ---- */
function DivergenceViz() {
  const W = 320, H = 210, pad = 18;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 44; i++) {
    const t = i / 44;
    const sep = Math.pow(10, -3 + t * 3.1);
    const y = H - pad - ((Math.log10(sep) + 3) / 3.1) * (H - pad * 2);
    pts.push([pad + t * (W - pad * 2), y]);
  }
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {[0, 1, 2, 3].map((g) => (
        <line key={g} x1={pad} y1={pad + (g / 3) * (H - pad * 2)} x2={W - pad} y2={pad + (g / 3) * (H - pad * 2)} stroke="#3a372b" strokeWidth={1} />
      ))}
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" />
      <text x={pad} y={H - 4} fontSize={10} fontWeight={700} fill="#c8c3b0">time →</text>
      <text x={W - pad} y={pad + 4} fontSize={10} fontWeight={700} textAnchor="end" fill="#c8c3b0">log |error|</text>
      <circle cx={pts[44][0]} cy={pts[44][1]} r={5} fill="var(--danger)" />
    </svg>
  );
}
