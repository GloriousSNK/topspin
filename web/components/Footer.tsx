import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          <div className="footer-col footer-brand">
            <div className="footer-lockup">
              <span className="brand-dot" />
              <span className="brand-name">TopSpin</span>
            </div>
            <p>Stroke analysis, focused practice, and ball-flight tools for tennis players.</p>
          </div>
          <div className="footer-col">
            <h5>Train</h5>
            <Link href="/analyze">Analyse a clip</Link>
            <Link href="/workouts">Practice</Link>
            <Link href="/ball-lab">Ball Lab</Link>
            <Link href="/stats">Stats</Link>
          </div>
          <div className="footer-col">
            <h5>Explore</h5>
            <Link href="/learn">Learn the physics</Link>
            <Link href="/insights">Insights</Link>
            <Link href="/about">About</Link>
          </div>
          <div className="footer-col">
            <h5>Account</h5>
            <Link href="/account">Account settings</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
        </div>
        <div className="footer-base">
          <span>&copy; {new Date().getFullYear()} TopSpin Labs</span>
          <span>Built for better practice.</span>
        </div>
      </div>
    </footer>
  );
}
