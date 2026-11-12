import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "Why we built TopSpin, who it's for, and how the stroke analysis and ball physics fit together.",
};

export default function About() {
  return (
    <>
      <section className="section" style={{ paddingTop: 64 }}>
        <div className="container" style={{ maxWidth: 820 }}>
          <span className="eyebrow">About</span>
          <h1 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "clamp(34px,5vw,48px)", fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.05, marginBottom: 18 }}>
            Why we built TopSpin.
          </h1>
          <p style={{ fontSize: 18, color: "var(--ink-soft)", lineHeight: 1.6 }}>
            TopSpin started with a simple frustration. Most tennis apps track what you did, like
            reps, rallies and minutes, but they don&apos;t tell you what to work on next. They won&apos;t
            tell you that your elbow drops at contact, or that the cross-court topspin you like is a
            couple of degrees away from going long. So we built the tool we wanted: analysis of your
            actual swing and real ball-flight physics, turned into a practice plan.
          </p>
        </div>
      </section>

      <section className="section" style={{ background: "var(--card)" }}>
        <div className="container">
          <h2 className="section-title">Who it&apos;s for</h2>
          <div className="grid grid-3" style={{ marginTop: 24 }}>
            {[
              { t: "Players who want to improve", d: "You practise regularly and want each session to work on a real weakness instead of just hitting more balls." },
              { t: "Coaches", d: "A second pair of eyes that puts numbers on what you already see and suggests drills to match. You can keep a folder for each student, and they don't need an account." },
              { t: "The curious", d: "You like the idea that a forehand is also a physics problem, and you want to see the maths in action." },
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
          <h2 className="section-title">How it works</h2>
          <p className="section-lead">Four steps. You can use any of them on its own.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { n: 1, t: "From clip to angles", d: "A pose model finds your joints in each frame, right in your browser, and picks out the moment of contact." },
              { n: 2, t: "From angles to feedback", d: "We compare your angles at contact with good positions for that stroke and score each joint, so you can see what's off." },
              { n: 3, t: "From problems to practice", d: "The problems it finds, worst first, become a practice session that fits your time, built from a library of more than 50 drills." },
              { n: 4, t: "From practice to prediction", d: "The Ball Lab simulates real ball flight, so you can try different spin, angles and margins and see what lands." },
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
          <h2 style={{ fontSize: 34 }}>Try it on your own stroke.</h2>
          <p>It runs on your own device. You don&apos;t need an account, and your video is never uploaded.</p>
          <Link href="/analyze" className="btn btn-lg">Open the app</Link>
        </div>
      </section>
    </>
  );
}
