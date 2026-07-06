import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "Why TopSpin exists, who it's for, and how the vision and physics fit together.",
};

export default function About() {
  return (
    <>
      <section className="section" style={{ paddingTop: 64 }}>
        <div className="container" style={{ maxWidth: 820 }}>
          <span className="eyebrow">About</span>
          <h1 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "clamp(34px,5vw,48px)", fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.05, marginBottom: 18 }}>
            Deliberate practice, made measurable.
          </h1>
          <p style={{ fontSize: 18, color: "var(--ink-soft)", lineHeight: 1.6 }}>
            TopSpin started from a simple frustration: most tennis apps count what you did, not what
            you should do next. They log reps and rallies, but they don&apos;t tell you that your
            elbow drops at contact, or that the cross-court topspin you love is two degrees away from
            spraying long. So we built the tool we actually wanted: real video analysis backed by
            real physics, instead of another plan that ignores how you hit.
          </p>
        </div>
      </section>

      <section className="section" style={{ background: "var(--card)" }}>
        <div className="container">
          <h2 className="section-title">Who it&apos;s for</h2>
          <div className="grid grid-3" style={{ marginTop: 24 }}>
            {[
              { t: "Improving players", d: "You practise regularly and want each session to target a real weakness, not just bank volume." },
              { t: "Coaches", d: "A second set of eyes that quantifies what you already sense, and turns it into prescribed drills." },
              { t: "The curious", d: "You like that a forehand is also a nonlinear dynamical system, and want to see that made tangible." },
            ].map((c) => (
              <div key={c.t} className="card">
                <h3 style={{ fontSize: 18, fontWeight: 750, marginBottom: 8 }}>{c.t}</h3>
                <p style={{ color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.6 }}>{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">How the pipeline fits together</h2>
          <p className="section-lead">Four stages, one clean flow. Each stage stands on its own.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { n: 1, t: "Clip to angles", d: "A pose model finds your joints in each frame, in the browser, and picks out the contact moment." },
              { n: 2, t: "Angles to feedback", d: "We compare your contact angles to sensible targets and score each joint, so you see what's off." },
              { n: 3, t: "Flaws to practice", d: "Your ranked flaws become a prioritised, time-boxed session pulled from a tagged drill catalogue." },
              { n: 4, t: "Practice to prediction", d: "The Ball Lab runs real flight physics and chaos analysis so you can dial in spin, angle, and margin." },
            ].map((s) => (
              <div key={s.n} className="card" style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
                <span className="step-num" style={{ marginBottom: 0, flexShrink: 0 }}>{s.n}</span>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 750, marginBottom: 4 }}>{s.t}</h3>
                  <p style={{ color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.6 }}>{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section cta-band">
        <div className="container">
          <h2 style={{ fontSize: 34 }}>See it on your own stroke.</h2>
          <p>It runs entirely on your machine. No account, nothing uploaded to the cloud.</p>
          <Link href="/analyze" className="btn btn-lg">Open the app</Link>
        </div>
      </section>
    </>
  );
}
