import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          <div className="footer-col" style={{ maxWidth: 260 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span className="brand-dot" />
              <span className="brand-name">TopSpin</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
              An AI tennis practice lab — stroke analysis, personalised drills, and
              chaos-aware ball-flight prediction.
            </p>
          </div>
          <div className="footer-col">
            <h5>Product</h5>
            <Link href="/analyze">Clip Analysis</Link>
            <Link href="/workouts">Drills & Workouts</Link>
            <Link href="/ball-lab">Ball Lab</Link>
          </div>
          <div className="footer-col">
            <h5>Learn</h5>
            <Link href="/learn">The physics, explained</Link>
            <Link href="/#how">How it works</Link>
            <Link href="/about">About</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
          <div className="footer-col">
            <h5>Project</h5>
            <a href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer">API docs</a>
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>v0.1 · runs locally</span>
          </div>
        </div>
        <div className="footer-base">
          <span>© {new Date().getFullYear()} TopSpin. Built for players who want to improve.</span>
          <span>Next.js · FastAPI · NumPy</span>
        </div>
      </div>
    </footer>
  );
}
