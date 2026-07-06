import Link from "next/link";
import type { Metadata } from "next";
import PhysicsHero from "@/components/lp/PhysicsHero";
import DispersionMap from "@/components/lp/DispersionMap";
import CourtMorph from "@/components/lp/CourtMorph";
import { Reveal, Counter, Magnetic } from "@/components/lp/Motion";

export const metadata: Metadata = {
  title: "TopSpin — The physics of a better game",
  description:
    "On-device stroke analysis, drills built from your real flaws, and ball-flight " +
    "prediction with genuine drag + Magnus physics. Nothing uploaded, nothing guessed.",
};

const MARQUEE = [
  "RK4 integration", "Drag + Magnus lift", "320-flight ensembles",
  "Finite-time Lyapunov", "33 pose landmarks", "0 clips uploaded",
  "Sub-second predictions", "34-drill engine",
];

export default function Landing() {
  return (
    <>
      {/* ================= HERO — the live simulation ================= */}
      <section className="lp-hero">
        <div className="lp-hero-scrim" aria-hidden="true" />
        <div className="container lp-hero-inner">
          <div>
            <span className="eyebrow">TopSpin · Practice intelligence</span>
            <h1>
              The physics of a <em>better game.</em>
            </h1>
            <p className="lp-hero-sub">
              Film one stroke. TopSpin reads your body like a coach, simulates your
              ball like an engineer, and hands you the one thing worth fixing.
            </p>
            <div className="lp-hero-cta">
              <Magnetic>
                <Link href="/analyze" className="btn btn-lg">Analyse my stroke</Link>
              </Magnetic>
              <Magnetic>
                <Link href="/ball-lab" className="btn btn-ghost btn-lg">Open the Ball Lab</Link>
              </Magnetic>
            </div>
            <p className="lp-hero-note">
              <b>ON-DEVICE.</b> Your footage never leaves your phone. No sign-up to try it.
            </p>
          </div>
          <PhysicsHero />
        </div>
        <div className="lp-scroll-cue" aria-hidden="true" />
      </section>

      {/* ================= CREDIBILITY STRIP ================= */}
      <div className="lp-strip" aria-hidden="true">
        <div className="lp-marquee">
          {[0, 1].map((set) => (
            <div className="lp-marquee-set" key={set}>
              {MARQUEE.map((t) => <span key={t}>{t}</span>)}
            </div>
          ))}
        </div>
      </div>

      {/* ================= 01 — FLIGHT ================= */}
      <section className="section" id="physics">
        <div className="container lp-split">
          <div>
            <Reveal><span className="lp-sec-num">01 / FLIGHT</span></Reveal>
            <Reveal delay={60}>
              <h2 className="lp-h2">A struck ball is a chaotic system. We treat it like one.</h2>
            </Reveal>
            <Reveal delay={120}>
              <p className="lp-body">
                After contact, your ball feels gravity, quadratic drag, and the Magnus
                force from spin — a nonlinear system with no closed-form answer. So we
                don&apos;t draw an arc. We integrate the flight step by step, then fly it
                hundreds of times with tiny contact variations to get honest odds.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <span className="lp-eq">
                m·a = F<sub>g</sub> + <b>−½ρC<sub>d</sub>A|v|v</b> + <b>½ρC<sub>l</sub>A|v|²·n̂</b>
              </span>
            </Reveal>
            <Reveal delay={240}>
              <p className="lp-body" style={{ marginBottom: 26 }}>
                Aim the reticle. Watch the spread grow as you get greedy with depth and
                lines — that spread is the margin you&apos;re actually playing with.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <Link href="/ball-lab" className="btn btn-ghost">Run your own numbers →</Link>
            </Reveal>
          </div>
          <DispersionMap />
        </div>
      </section>

      {/* ================= 02 — FORM ================= */}
      <section className="section" id="form" style={{ paddingTop: 30 }}>
        <div className="container lp-split rev">
          <CourtMorph />
          <div>
            <Reveal><span className="lp-sec-num">02 / FORM</span></Reveal>
            <Reveal delay={60}>
              <h2 className="lp-h2">The court learns to <em>see you.</em></h2>
            </Reveal>
            <Reveal delay={120}>
              <p className="lp-body">
                Drop in a clip and a pose model traces 33 landmarks through your swing —
                on your device, frame by frame. At contact we measure elbow, knee and
                trunk angles against stroke-specific targets and score the whole motion
                from 0 to 100. No generic tips; the feedback is about the swing you
                actually made.
              </p>
            </Reveal>
            <Reveal delay={200}>
              <div className="lp-pipeline">
                {["Upload", "33 landmarks", "Contact frame", "Joint angles", "Score /100"].map((s, i, arr) => (
                  <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <span className="lp-pipe-step">{s}</span>
                    {i < arr.length - 1 && <span className="lp-pipe-arrow">→</span>}
                  </span>
                ))}
              </div>
            </Reveal>
            <Reveal delay={280}>
              <Link href="/analyze" className="btn btn-ghost" style={{ marginTop: 30 }}>Analyse a clip →</Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= 03 — TRAINING ================= */}
      <section className="section" id="training" style={{ paddingTop: 30 }}>
        <div className="container lp-split">
          <div>
            <Reveal><span className="lp-sec-num">03 / TRAINING</span></Reveal>
            <Reveal delay={60}>
              <h2 className="lp-h2">Your session assembles itself.</h2>
            </Reveal>
            <Reveal delay={120}>
              <p className="lp-body">
                Every flaw the analysis finds is wired to drills that fix it. Your worst
                habit gets worked first, the session fits the minutes you have, and each
                line tells you why it&apos;s there. Saved workouts live on your Stats page
                with your form trend — the loop closes.
              </p>
            </Reveal>
            <Reveal delay={200}>
              <Link href="/workouts" className="btn btn-ghost">Build a session →</Link>
            </Reveal>
          </div>
          <div className="lp-panel">
            <div className="lp-panel-head">
              <span>Generated session</span>
              <span className="val">24 MIN</span>
            </div>
            <div>
              {[
                { n: "Shadow unit-turn timing", m: "3 × 12 · 6 min", why: "LATE PREP" },
                { n: "Elbow-up wall rally", m: "4 × 20 · 9 min", why: "DROPPED ELBOW" },
                { n: "Front-foot loading step-in", m: "3 × 15 · 9 min", why: "NARROW BASE" },
              ].map((d, i) => (
                <Reveal key={d.n} delay={140 + i * 140}>
                  <div className="lp-session-row">
                    <div>
                      <div className="n">{d.n}</div>
                      <div className="m">{d.m}</div>
                    </div>
                    <span className="why">{d.why}</span>
                  </div>
                </Reveal>
              ))}
            </div>
            <div className="lp-panel-foot">
              <span>PRIORITISED BY FLAW SEVERITY</span>
              <span>FITS YOUR TIME BUDGET</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= NUMBERS ================= */}
      <section aria-label="By the numbers">
        <div className="container">
          <div className="lp-numbers">
            <Reveal className="lp-number" delay={0}>
              <span className="v"><Counter to={320} /></span>
              <span className="k">Flights per prediction</span>
            </Reveal>
            <Reveal className="lp-number" delay={90}>
              <span className="v"><Counter to={33} /></span>
              <span className="k">Pose landmarks tracked</span>
            </Reveal>
            <Reveal className="lp-number" delay={180}>
              <span className="v"><Counter to={0.7} decimals={1} suffix="s" /></span>
              <span className="k">Full physics prediction</span>
            </Reveal>
            <Reveal className="lp-number" delay={270}>
              <span className="v"><Counter to={0} /></span>
              <span className="k">Clips uploaded, ever</span>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= STATEMENT ================= */}
      <section className="lp-statement">
        <div className="container">
          <Reveal>
            <h2>Your footage stays on your phone. <em>Full stop.</em></h2>
          </Reveal>
          <Reveal delay={120}>
            <p>Pose runs in your browser · No account required · Analytics self-hosted, cookie-free</p>
          </Reveal>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="lp-cta">
        <div className="container">
          <Reveal>
            <h2>Curious what your forehand is hiding?</h2>
          </Reveal>
          <Reveal delay={100}>
            <p>One clip. A few seconds. One clear thing to fix.</p>
          </Reveal>
          <Reveal delay={200}>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <Magnetic>
                <Link href="/analyze" className="btn btn-lg">Analyse my stroke</Link>
              </Magnetic>
              <Magnetic>
                <Link href="/learn" className="btn btn-ghost btn-lg">Read the physics</Link>
              </Magnetic>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
