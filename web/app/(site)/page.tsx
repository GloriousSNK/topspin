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
    "Film one stroke and TopSpin checks your form on your own device, then simulates where " +
    "the ball goes using real drag and spin physics. Your video is never uploaded.",
};

export default function Landing() {
  return (
    <>
      {/* ================= HERO — the live simulation ================= */}
      <section className="lp-hero">
        <div className="lp-hero-scrim" aria-hidden="true" />
        <div className="container lp-hero-inner">
          <div>
            <span className="eyebrow">TopSpin · Stroke analysis and ball flight</span>
            <h1>
              The physics of a <em>better game.</em>
            </h1>
            <p className="lp-hero-sub">
              Film one stroke and TopSpin checks your form, shows where that ball would land,
              and tells you what to work on first.
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
              <b>ON-DEVICE.</b> Your video is analysed on your device and never uploaded. No account needed.
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
              <h2 className="lp-h2">Why the same swing doesn&apos;t land in the same spot.</h2>
            </Reveal>
            <Reveal delay={120}>
              <p className="lp-body">
                After the ball leaves your strings, three things act on it: gravity, air drag and
                the Magnus force from spin. There&apos;s no neat formula for where it lands, so we
                simulate the flight in tiny time steps. Then we run it a few hundred more times
                with small changes to speed, angle and spin to get a realistic in/out percentage.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <span className="lp-eq">
                m·a = F<sub>g</sub> + <b>−½ρC<sub>d</sub>A|v|v</b> + <b>½ρC<sub>l</sub>A|v|²·n̂</b>
              </span>
            </Reveal>
            <Reveal delay={240}>
              <p className="lp-body" style={{ marginBottom: 26 }}>
                Move the target around the court. The closer you aim to the lines, the more of
                the spread lands out. That spread is your real margin for error.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <Link href="/ball-lab" className="btn btn-ghost">Try it in the Ball Lab →</Link>
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
              <h2 className="lp-h2">See what your body is <em>actually doing.</em></h2>
            </Reveal>
            <Reveal delay={120}>
              <p className="lp-body">
                Upload a clip and a pose model tracks 33 points on your body through the swing,
                right on your device. At the moment of contact it measures your elbow, knee and
                trunk angles, compares them with good positions for that stroke, and scores the
                swing out of 100. Every note you get comes from your own clip.
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
              <h2 className="lp-h2">A practice plan for what it found.</h2>
            </Reveal>
            <Reveal delay={120}>
              <p className="lp-body">
                Each problem the analysis finds is linked to drills that work on it. The biggest
                one comes first, the session fits the time you have, and each drill says which
                problem it&apos;s for. Saved sessions show up on your Stats page next to your form
                scores, so you can see whether the practice is paying off.
              </p>
            </Reveal>
            <Reveal delay={200}>
              <Link href="/workouts" className="btn btn-ghost">Build a session →</Link>
            </Reveal>
          </div>
          <div className="lp-panel">
            <div className="lp-panel-head">
              <span>Sample session</span>
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
              <span>BIGGEST PROBLEM FIRST</span>
              <span>FITS YOUR TIME</span>
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
            <h2>Your videos stay <em>on your device.</em></h2>
          </Reveal>
          <Reveal delay={120}>
            <p>Pose tracking runs in your browser · No account needed · Our own analytics, no cookies</p>
          </Reveal>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="lp-cta">
        <div className="container">
          <Reveal>
            <h2>Want a second look at your forehand?</h2>
          </Reveal>
          <Reveal delay={100}>
            <p>Film a few seconds of one stroke and see what TopSpin picks up.</p>
          </Reveal>
          <Reveal delay={200}>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <Magnetic>
                <Link href="/analyze" className="btn btn-lg">Analyse my stroke</Link>
              </Magnetic>
              <Magnetic>
                <Link href="/learn" className="btn btn-ghost btn-lg">How the physics works</Link>
              </Magnetic>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
