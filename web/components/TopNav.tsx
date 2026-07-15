"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandMark from "./BrandMark";
import MobileMenu from "./MobileMenu";
import { useAuth } from "./AuthProvider";

// One nav for the whole site. Same on every page, so it never "changes".
export default function TopNav() {
  const path = usePathname();
  const { user } = useAuth();

  const links = [
    { href: "/analyze", label: "Analyse" },
    { href: "/batch", label: "Batch" },
    { href: "/ball-lab", label: "Ball Lab" },
    { href: "/workouts", label: "Drills" },
    { href: "/stats", label: "Stats" },
    ...(user ? [{ href: "/coach", label: "Coach" }] : []),
    { href: "/learn", label: "Learn" },
  ];
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  const mobileLinks = [
    ...links,
    { href: "/insights", label: "Insights" },
    { href: "/about", label: "About" },
    { href: "/account", label: user ? "Account" : "Sign in" },
  ];

  const initial = (user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <header className="navbar">
      <div className="container">
        <div className="navbar-inner">
          <BrandMark href="/" />
          <nav className="navlinks">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={active(l.href) ? "active" : ""}>{l.label}</Link>
            ))}
          </nav>
          <span className="nav-spacer" />
          {user ? (
            <Link href="/account" className={`nav-account ${active("/account") ? "on" : ""}`}>
              <span className="nav-avatar">{initial}</span>
              <span className="nav-email">{user.email}</span>
            </Link>
          ) : (
            <Link href="/account" className="btn">Sign in</Link>
          )}
          <MobileMenu links={mobileLinks} />
        </div>
      </div>
    </header>
  );
}
