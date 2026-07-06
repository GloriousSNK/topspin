import Link from "next/link";
import type { Metadata } from "next";
import { ScrollFlight, ChaosScroll } from "@/components/lp/Playground";
import DispersionMap from "@/components/lp/DispersionMap";
import { Reveal } from "@/components/lp/Motion";

export const metadata: Metadata = {
  title: "Learn — The physics behind TopSpin",
  description:
    "Play with the real forces on a tennis ball: break the school parabola, watch two identical " +
    "shots diverge, and aim a 320-flight landing ensemble with your cursor.",
};

export default function Learn() {
  return (
    <>
      {/* ---------------- intro ---------------- */}
      <section className="section" style={{ paddingTop: 64, paddingBottom: 60 }}>
        <div className="container" style={{ maxWidth: 860 }}>
          <span className="eyebrow">Learn</span>
          <h1 className="lp-h2" style={{ fontSize: "clamp(36px, 5vw, 56px)" }}>
            Don&apos;t read the physics. <em>Play it.</em>
          </h1>
          <p style={{ fontSize: 17, color: "var(--ink-soft)", lineHeight: 1.7, maxWidth: 620 }}>
            Everything on this page runs the same flight model as the Ball Lab, and it plays out
            as you scroll — balls fly, gaps grow, odds shift. Five minutes and you&apos;ll know
            exactly why that &quot;identical&quot; forehand landed two feet shorter.
          </p>
        </div>
      </section>

      {/* ---------------- 01 forces ---------------- */}
      <section className="section" style={{ paddingTop: 30 }}>
        <div className="container lp-split">
          <div>
            <Reveal><span className="lp-sec-num">01 / THE FORCES</span></Reveal>
            <Reveal delay={60}><h2 className="lp-h2">Three forces, fighting the whole way.</h2></Reveal>
            <Reveal delay={120}>
              <p className="lp-body">
                The moment the ball leaves your strings, exactly three things touch it.
                <b style={{ color: "var(--ink)" }}> Gravity</b> pulls straight down — constant,
                boring, predictable. <b style={{ color: "var(--ink)" }}>Drag</b> is the air pushing
                back along the flight path, and it grows with the <i>square</i> of speed, so a fast
                ball gets punished far harder than a slow one.
                <b style={{ color: "var(--ink)" }}> Magnus</b> is the spin force: a spinning ball
                drags a layer of air around with it, which shoves it sideways — down for topspin,
                up for slice.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <p className="lp-body">
                If you remember one thing, make it this: <b style={{ color: "var(--ink)" }}>drag is
                about speed, Magnus is about spin</b>. Those are the two dials you&apos;re turning
                on every single shot, whether you know it or not.
              </p>
            </Reveal>
          </div>
          <Reveal delay={120}>
            <div className="lp-panel">
              <div className="lp-panel-head">
                <span>Free-body diagram</span>
                <span className="val">TOPSPIN, MID-FLIGHT</span>
              </div>
              <div style={{ padding: 18 }}>
                <ForcesDiagram />
              </div>
              <div className="lp-panel-foot">
                <span style={{ color: "var(--court)" }}>GRAVITY</span>
                <span style={{ color: "var(--danger)" }}>DRAG</span>
                <span style={{ color: "var(--accent-dim)" }}>MAGNUS</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- 02 break the parabola ---------------- */}
      <section className="section" style={{ paddingTop: 40 }}>
        <div className="container lp-split rev">
          <ScrollFlight />
          <div>
            <Reveal><span className="lp-sec-num">02 / WHY WE SIMULATE</span></Reveal>
            <Reveal delay={60}><h2 className="lp-h2">Break the school parabola.</h2></Reveal>
            <Reveal delay={120}>
              <p className="lp-body">
                The clean arc you learned in school only works in a vacuum. Add drag — which
                depends on speed — and Magnus — which depends on speed <i>and</i> direction — and
                the equation starts feeding on its own answer. No formula survives that. The only
                honest way to know where the ball lands is to march it forward: tiny time step,
                recompute the forces, nudge the ball, repeat a few hundred times until it bounces.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <p className="lp-body">
                Just scroll. The same swing flies three times: the dotted arc is the textbook
                fantasy, the blue one adds air, the green one adds spin. By the time they land,
                the fantasy has overshot by <i>metres</i> — the difference between painting the
                baseline and feeding your opponent a short ball.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <span className="lp-eq">step · <b>dt = 1/240 s</b> · method · <b>RK4</b> — same maths that plots planetary orbits</span>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------- 03 chaos ---------------- */}
      <section className="section" style={{ paddingTop: 40 }}>
        <div className="container lp-split">
          <div>
            <Reveal><span className="lp-sec-num">03 / THE CHAOS PART</span></Reveal>
            <Reveal delay={60}><h2 className="lp-h2">Tiny errors don&apos;t <em>stay</em> tiny.</h2></Reveal>
            <Reveal delay={120}>
              <p className="lp-body">
                Here&apos;s the unsettling part. Those forces feed on each other, which makes ball
                flight genuinely chaotic. The two shots beside this leave the strings a third of a
                degree apart — a slip you couldn&apos;t feel if you tried — and the gap between
                them grows the entire way down.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <p className="lp-body">
                There&apos;s a single number for how fast that blow-up happens — the Ball Lab calls
                it <b style={{ color: "var(--ink)" }}>λ</b> (a Lyapunov exponent). Big λ: a twitchy,
                unforgiving shot. Small λ: room to spare. A flat drive aimed at a line runs hot; a
                loopy topspin ball with net clearance stays calm. Now you can measure which one
                you&apos;re actually hitting.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <p className="lp-body" style={{ marginBottom: 0 }}>
                Keep scrolling and watch them split. That&apos;s exponential divergence — not a
                metaphor, the actual thing, happening to your forehand.
              </p>
            </Reveal>
          </div>
          <ChaosScroll />
        </div>
      </section>

      {/* ---------------- 04 ensemble ---------------- */}
      <section className="section" style={{ paddingTop: 40 }}>
        <div className="container lp-split rev">
          <DispersionMap />
          <div>
            <Reveal><span className="lp-sec-num">04 / THE HONEST FORECAST</span></Reveal>
            <Reveal delay={60}><h2 className="lp-h2">A cloud, not a point.</h2></Reveal>
            <Reveal delay={120}>
              <p className="lp-body">
                If no swing is exactly repeatable, a single predicted landing spot is a polite
                fiction. So we do what weather forecasters do: jitter the contact hundreds of times
                by realistic amounts — a little speed, a little angle, a little spin — and fly every
                version. The spread is your real margin, and the fraction that stays in is a real
                in/out probability.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <p className="lp-body">
                A shot that looks &quot;in&quot; on paper but only stays in six times out of ten is
                telling you something no single trajectory ever could. Move your cursor over the
                court — get greedy with the lines and watch your own odds fall.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <Link href="/ball-lab" className="btn btn-ghost">Fly your own shot →</Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------- 05 the other half ---------------- */}
      <section className="section" style={{ paddingTop: 40, paddingBottom: 70 }}>
        <div className="container" style={{ maxWidth: 860 }}>
          <Reveal><span className="lp-sec-num">05 / THE OTHER HALF</span></Reveal>
          <Reveal delay={60}><h2 className="lp-h2">The physics reads the ball. The vision reads <em>you.</em></h2></Reveal>
          <Reveal delay={120}>
            <p className="lp-body" style={{ maxWidth: 640 }}>
              A pose model finds 33 landmarks on your body in every frame of your clip, right in
              the browser — nothing is uploaded, ever. From those we pick the contact moment,
              measure your elbow, knee and trunk angles against stroke-specific targets, and score
              the swing 0–100. Flaws become drills, drills become sessions, and your Stats page
              keeps the receipts.
            </p>
          </Reveal>
          <Reveal delay={180}>
            <div className="lp-pipeline">
              {["Clip", "33 landmarks", "Contact frame", "Joint angles", "Score /100", "Drills"].map((s, i, arr) => (
                <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <span className="lp-pipe-step">{s}</span>
                  {i < arr.length - 1 && <span className="lp-pipe-arrow">→</span>}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="lp-cta">
        <div className="container">
          <Reveal><h2>Enough theory. Hit something.</h2></Reveal>
          <Reveal delay={100}><p>The Ball Lab turns all of this into sliders — with your shot, your spin, your odds.</p></Reveal>
          <Reveal delay={200}>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/ball-lab" className="btn btn-lg">Open the Ball Lab</Link>
              <Link href="/analyze" className="btn btn-ghost btn-lg">Analyse my stroke</Link>
            </div>
          </Reveal>
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
      <Arrow x1={cx} y1={cy} x2={cx + 78} y2={cy - 78} color="var(--ink-soft)" label="v" lx={cx + 86} ly={cy - 82} dash />
      <Arrow x1={cx} y1={cy} x2={cx} y2={cy + 86} color="var(--court)" label="gravity" lx={cx + 4} ly={cy + 100} />
      <Arrow x1={cx} y1={cy} x2={cx - 66} y2={cy + 66} color="var(--danger)" label="drag" lx={cx - 92} ly={cy + 78} />
      <Arrow x1={cx} y1={cy} x2={cx + 62} y2={cy + 62} color="var(--accent-dim)" label="Magnus" lx={cx + 66} ly={cy + 80} />
      <circle cx={cx} cy={cy} r={16} fill="var(--accent)" stroke="rgba(29,34,27,0.5)" strokeWidth={1.5} />
      <path d={`M ${cx - 14} ${cy - 7} Q ${cx} ${cy + 4} ${cx + 14} ${cy - 7}`} fill="none" stroke="rgba(29,34,27,0.5)" strokeWidth={1.5} />
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
