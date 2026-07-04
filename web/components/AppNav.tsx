"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandMark from "./BrandMark";
import MobileMenu from "./MobileMenu";

const TABS = [
  { href: "/analyze", label: "Analyse" },
  { href: "/workouts", label: "Drills" },
  { href: "/ball-lab", label: "Ball Lab" },
  { href: "/progress", label: "Progress" },
  { href: "/insights", label: "Insights" },
  { href: "/account", label: "Account" },
];

export default function AppNav() {
  const path = usePathname();
  return (
    <header className="navbar">
      <div className="container">
        <div className="navbar-inner">
          <BrandMark href="/" />
          <nav className="navlinks">
            {TABS.map((t) => (
              <Link key={t.href} href={t.href} className={path.startsWith(t.href) ? "active" : ""}>
                {t.label}
              </Link>
            ))}
          </nav>
          <span className="nav-spacer" />
          <Link href="/" className="btn btn-ghost">← Back to site</Link>
          <MobileMenu links={TABS} cta={{ href: "/", label: "← Back to site" }} />
        </div>
      </div>
    </header>
  );
}
