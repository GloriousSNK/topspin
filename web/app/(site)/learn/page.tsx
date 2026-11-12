import Link from "next/link";
import type { Metadata } from "next";
import { ScrollFlight, ChaosScroll } from "@/components/lp/Playground";
import DispersionMap from "@/components/lp/DispersionMap";
import { Reveal } from "@/components/lp/Motion";

export const metadata: Metadata = {
  title: "How a tennis ball flies",
  description:
    "See the forces acting on a tennis ball, why a real shot doesn't follow the school parabola, " +
    "how two nearly identical shots drift apart, and where 320 simulated shots land.",
};

export default function Learn() {
  return (
    <>
      {/* ---------------- intro ---------------- */}
      <section className="section" style={{ paddingTop: 64, paddingBottom: 60 }}>
        <div className="container" style={{ maxWidth: 860 }}>
          <span className="eyebrow">Learn</span>
          <h1 className="lp-h2" style={{ fontSize: "clamp(36px, 5vw, 56px)" }}>
            How a tennis ball <em>really flies.</em>
          </h1>
          <p style={{ fontSize: 17, color: "var(--ink-soft)", lineHeight: 1.7, maxWidth: 620 }}>
            Everything on this page uses the same flight model as the Ball Lab, and the animations
            move as you scroll. It takes about five minutes, and by the end you&apos;ll know why two
            forehands that felt the same landed two feet apart.
          </p>
        </div>
      </section>

      {/* ---------------- 01 forces ---------------- */}
      <section className="section" style={{ paddingTop: 30 }}>
        <div className="container lp-split">
          <div>
            <Reveal><span className="lp-sec-num">01 / THE FORCES</span></Reveal>
            <Reveal delay={60}><h2 className="lp-h2">Three forces act on every shot.</h2></Reveal>
            <Reveal delay={120}>
              <p className="lp-body">
                Once the ball leaves your strings, only three things act on it.
                <b style={{ color: "var(--ink)" }}> Gravity</b> pulls it straight down at a steady
                rate. <b style={{ color: "var(--ink)" }}>Drag</b> is air resistance pushing back along
                the flight path. It grows with the <i>square</i> of the speed, so a fast ball slows
                down much more than a slow one. <b style={{ color: "var(--ink)" }}>Magnus</b>
                {" "}is the force from spin. A spinning ball pulls a thin layer of air around with
                it, and that pushes the ball sideways: down for topspin, up for slice.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <p className="lp-body">
                The short version: <b style={{ color: "var(--ink)" }}>drag depends on speed, and
                Magnus depends on spin</b>. Those are the two things you change every time you
                swing.
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
            <Reveal delay={60}><h2 className="lp-h2">Why the school parabola is wrong.</h2></Reveal>
            <Reveal delay={120}>
              <p className="lp-body">
                The neat arc from school physics assumes there&apos;s no air. Add drag, which depends
                on speed, and Magnus, which depends on speed <i>and</i>{" "}direction, and the forces
                keep changing as the ball flies. There&apos;s no simple formula for that, so we move
                the ball forward in tiny time steps: work out the forces, move the ball a little,
                and repeat a few hundred times until it bounces.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <p className="lp-body">
                Scroll to watch the same swing three times. The dotted line is the textbook arc, the
                blue one adds air resistance, and the green one adds spin as well. By the time they
                land, the textbook arc has gone several <i>metres</i>{" "}too far. On court, that&apos;s
                the difference between a ball that lands deep and one that goes long.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <span className="lp-eq">step · <b>dt = 1/240 s</b> · method · <b>RK4</b> · the same method used to plot planet orbits</span>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------- 03 chaos ---------------- */}
      <section className="section" style={{ paddingTop: 40 }}>
        <div className="container lp-split">
          <div>
            <Reveal><span className="lp-sec-num">03 / SMALL ERRORS</span></Reveal>
            <Reveal delay={60}><h2 className="lp-h2">Tiny errors don&apos;t <em>stay</em> tiny.</h2></Reveal>
            <Reveal delay={120}>
              <p className="lp-body">
                Because those forces depend on each other, ball flight is chaotic in the
                mathematical sense. The two shots next to this text leave the strings a third of a
                degree apart, which you&apos;d never feel, and the gap between them keeps growing all
                the way down.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <p className="lp-body">
                The Ball Lab measures how fast that gap grows with a number called
                {" "}<b style={{ color: "var(--ink)" }}>λ</b>, a Lyapunov exponent. A big λ means the
                shot has very little room for error. A small one means you have some margin. A flat
                drive aimed at a line usually has a big λ, and a high topspin ball with plenty of net
                clearance has a small one. The Ball Lab shows you which kind you&apos;re hitting.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <p className="lp-body" style={{ marginBottom: 0 }}>
                Keep scrolling to watch the two shots split apart. Mathematicians call this
                exponential divergence, and it&apos;s the same reason weather is hard to forecast.
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
            <Reveal><span className="lp-sec-num">04 / THE FORECAST</span></Reveal>
            <Reveal delay={60}><h2 className="lp-h2">Predicting a spread, not a spot.</h2></Reveal>
            <Reveal delay={120}>
              <p className="lp-body">
                Nobody hits exactly the same swing twice, so one predicted landing spot doesn&apos;t
                tell you much. We use the trick weather forecasters use: change the contact slightly
                a few hundred times (a bit more or less speed, angle and spin) and simulate every
                version. The spread shows your real margin, and the share of shots that land in
                gives you an in/out percentage.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <p className="lp-body">
                A shot that looks in on paper but only lands in six times out of ten is a risky
                shot, and a single prediction would never show you that. Move your cursor over the
                court, aim closer to the lines, and watch the percentage drop.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <Link href="/ball-lab" className="btn btn-ghost">Try your own shot →</Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------- 05 the other half ---------------- */}
      <section className="section" style={{ paddingTop: 40, paddingBottom: 70 }}>
        <div className="container" style={{ maxWidth: 860 }}>
          <Reveal><span className="lp-sec-num">05 / YOUR FORM</span></Reveal>
          <Reveal delay={60}><h2 className="lp-h2">Then there&apos;s <em>your swing.</em></h2></Reveal>
          <Reveal delay={120}>
            <p className="lp-body" style={{ maxWidth: 640 }}>
              A pose model finds 33 points on your body in every frame of your clip, right in your
              browser, and the video is never uploaded. From those points we find the moment of
              contact, measure your elbow, knee and trunk angles against good positions for that
              stroke, and score the swing out of 100. Any problems it finds turn into drills, the
              drills make up a practice session, and your Stats page tracks your scores over time.
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
          <Reveal><h2>Ready to try your own shots?</h2></Reveal>
          <Reveal delay={100}><p>The Ball Lab puts all of this on sliders, so you can set your own speed and spin and see the odds.</p></Reveal>
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
