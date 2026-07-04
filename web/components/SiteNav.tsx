import Link from "next/link";
import BrandMark from "./BrandMark";
import MobileMenu from "./MobileMenu";

// Tools are linked directly now, so nothing hides behind "open the app".
const LINKS = [
  { href: "/ball-lab", label: "Ball Lab" },
  { href: "/workouts", label: "Drills" },
  { href: "/learn", label: "Learn" },
  { href: "/about", label: "About" },
];

const MOBILE = [
  { href: "/analyze", label: "Analyse a clip" },
  ...LINKS,
  { href: "/insights", label: "Insights" },
  { href: "/account", label: "Sign in" },
];

export default function SiteNav() {
  return (
    <header className="navbar">
      <div className="container">
        <div className="navbar-inner">
          <BrandMark href="/" />
          <nav className="navlinks">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href}>{l.label}</Link>
            ))}
          </nav>
          <span className="nav-spacer" />
          <Link href="/account" className="btn btn-ghost nav-signin">Sign in</Link>
          <Link href="/analyze" className="btn">Analyse a clip</Link>
          <MobileMenu links={MOBILE} cta={{ href: "/analyze", label: "Analyse a clip" }} />
        </div>
      </div>
    </header>
  );
}
