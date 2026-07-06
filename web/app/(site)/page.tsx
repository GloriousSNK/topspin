import Link from "next/link";
import type { Metadata } from "next";
import PhysicsHero from "@/components/lp/PhysicsHero";
import DispersionMap from "@/components/lp/DispersionMap";
import CourtMorph from "@/components/lp/CourtMorph";
import LiveMarquee from "@/components/lp/LiveMarquee";
import LiveNumbers from "@/components/lp/LiveNumbers";
import { Reveal, Magnetic } from "@/components/lp/Motion";

export const metadata: Metadata = {
  title: { absolute: "TopSpin · The physics of a better game" },
  description:
    "Film one stroke. TopSpin reads your form on your own device, then predicts your ball " +
    "flight with real drag and Magnus physics. Your footage never leaves your phone.",
};

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
              Film one stroke. TopSpin reads your body the way a coach would, flies your ball
              the way an engineer would, and hands you the one thing worth fixing.
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

      {/* ================= CREDIBILITY STRIP (live) ================= */}
      <LiveMarquee />

      {/* ================= 01 — FLIGHT ================= */}
      <section className="section" id="physics">
        <div className="container lp-split">
          <div>
            <Reveal><span className="lp-sec-num">01 / FLIGHT</span></Reveal>
            <Reveal delay={60}>
              <h2 className="lp-h2">A struck ball is a chaotic system, so we treat it like one.</h2>
            </Reveal>
            <Reveal delay={120}>
              <p className="lp-body">
                Once it leaves your strings the ball feels three things: gravity, drag from the
                air, and the Magnus force from spin. There&apos;s no clean formula for where that
                lands, so we don&apos;t fake one with a smooth arc. We march the flight forward
                step by step, then fly it a few hundred times with tiny variations to get honest
                odds.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <span className="lp-eq">
                m·a = F<sub>g</sub> + <b>−½ρC<sub>d</sub>A|v|v</b> + <b>½ρC<sub>l</sub>A|v|²·n̂</b>
              </span>
            </Reveal>
            <Reveal delay={240}>
              <p className="lp-body" style={{ marginBottom: 26 }}>
                Aim the reticle and watch the spread grow as you get greedy with depth and the
                lines. That spread is the margin you&apos;re actually playing with.
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
                Drop in a clip and a pose model traces 33 landmarks through your swing, frame by
                frame, right on your device. At contact we measure your elbow, knee and trunk
                angles against stroke-specific targets, then score the whole motion out of 100.
                You won&apos;t get generic tips. The feedback is about the swing you actually made.
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
                Every flaw the analysis turns up is wired to drills that fix it. Your worst habit
                gets worked first, the session fits the minutes you actually have, and every line
                tells you why it&apos;s there. Saved workouts sit on your Stats page next to your
                form trend, so the loop closes on its own.
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

      {/* ================= NUMBERS (last cell is live) ================= */}
      <LiveNumbers />

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
