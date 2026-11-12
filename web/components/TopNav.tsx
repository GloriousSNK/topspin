"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandMark from "./BrandMark";
import MobileMenu, { type NavGroup, type NavItem } from "./MobileMenu";
import { useAuth } from "./AuthProvider";

const PLAYER_PRIMARY: NavItem[] = [
  { href: "/analyze", label: "Analyse" },
  { href: "/workouts", label: "Practice" },
  { href: "/ball-lab", label: "Ball Lab" },
  { href: "/stats", label: "Stats" },
];

const COACH_PRIMARY: NavItem[] = [
  { href: "/analyze", label: "Analyse" },
  { href: "/students", label: "Students" },
  { href: "/coach", label: "Roster" },
  { href: "/workouts", label: "Practice" },
  { href: "/stats", label: "Stats" },
];

const EXPLORE: NavItem[] = [
  { href: "/learn", label: "Learn", description: "The physics behind the ball" },
  { href: "/insights", label: "Insights", description: "How much TopSpin is being used" },
  { href: "/about", label: "About", description: "Why we built TopSpin" },
];

// Static per role, so they are built once rather than on every render.
const COACH_MORE: NavGroup[] = [
  {
    label: "Coach",
    items: [{ href: "/account#coach-connection", label: "Squads & account", description: "Codes, profile and account settings" }],
  },
  {
    label: "More tools",
    items: [
      { href: "/batch", label: "Batch analysis", description: "Queue several clips" },
      { href: "/ball-lab", label: "Ball Lab", description: "Explore flight and spin" },
    ],
  },
  { label: "Explore", items: EXPLORE },
];

const PLAYER_MORE: NavGroup[] = [
  {
    label: "Analysis",
    items: [{ href: "/batch", label: "Batch analysis", description: "Queue several clips" }],
  },
  { label: "Explore", items: EXPLORE },
];

const COACH_MOBILE: NavGroup[] = [{ label: "Coach workspace", items: COACH_PRIMARY }, ...COACH_MORE];
const PLAYER_MOBILE: NavGroup[] = [{ label: "Train", items: PLAYER_PRIMARY }, ...PLAYER_MORE];

export function routeIsActive(path: string, href: string): boolean {
  const [route, fragment] = href.split("#");
  if (fragment) return false;
  return route === "/" ? path === "/" : path === route || path.startsWith(`${route}/`);
}

export default function TopNav() {
  const path = usePathname();
  const { user, loading, role } = useAuth();
  const isCoach = role === "coach";
  const primary = isCoach ? COACH_PRIMARY : PLAYER_PRIMARY;
  const moreGroups = isCoach ? COACH_MORE : PLAYER_MORE;
  const mobileGroups = isCoach ? COACH_MOBILE : PLAYER_MOBILE;
  const initial = (user?.email ?? "?").charAt(0).toUpperCase();
  const roleLabel = isCoach ? "Coach" : role === "player" ? "Player" : "Account";
  const signedIn = !!user;
  const email = user?.email;
  // Stable props so the memoised MobileMenu skips re-rendering on unrelated updates.
  const account = useMemo(() => ({ href: "/account", label: signedIn ? "Account settings" : "Sign in or create account" }), [signedIn]);
  const identity = useMemo(() => signedIn ? { email: email ?? "Signed in", role: roleLabel } : null, [signedIn, email, roleLabel]);

  return (
    <header className="navbar">
      <div className="container">
        <div className="navbar-inner">
          <BrandMark href="/" />
          <nav className="navlinks" aria-label="Primary navigation">
            {primary.map((item) => {
              const active = routeIsActive(path, item.href);
              return (
                <Link key={item.href} href={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
                  {item.label}
                </Link>
              );
            })}
            <MoreMenu groups={moreGroups} path={path} />
          </nav>
          <span className="nav-spacer" />
          {loading ? (
            <span className="nav-auth-placeholder" aria-label="Loading account" />
          ) : user ? (
            <Link href="/account" className={`nav-account ${routeIsActive(path, "/account") ? "on" : ""}`} aria-current={routeIsActive(path, "/account") ? "page" : undefined}>
              <span className="nav-avatar" aria-hidden="true">{initial}</span>
              <span className="nav-account-copy">
                <span className="nav-email">{user.email}</span>
                <span className="nav-role">{roleLabel}</span>
              </span>
            </Link>
          ) : (
            <Link href="/account" className="btn btn-ghost nav-signin">Sign in</Link>
          )}
          <MobileMenu
            groups={mobileGroups}
            account={account}
            identity={identity}
            loading={loading}
          />
        </div>
      </div>
    </header>
  );
}

const MoreMenu = memo(function MoreMenu({ groups, path }: { groups: NavGroup[]; path: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const active = groups.some((group) => group.items.some((item) => routeIsActive(path, item.href)));

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div className="nav-more" ref={root}>
      <button
        ref={trigger}
        className={`nav-menu-trigger ${active ? "active" : ""}`}
        type="button"
        aria-expanded={open}
        aria-controls="desktop-more-menu"
        onClick={() => setOpen((value) => !value)}
      >
        More <span className="nav-chevron" aria-hidden="true" />
      </button>
      {open && (
        <nav id="desktop-more-menu" className="nav-popover" aria-label="More navigation">
          {groups.map((group) => (
            <div className="nav-popover-group" key={group.label}>
              <span className="nav-group-label">{group.label}</span>
              {group.items.map((item) => {
                const current = routeIsActive(path, item.href);
                return (
                  <Link key={item.href} href={item.href} className={current ? "active" : ""} aria-current={current ? "page" : undefined} onClick={() => setOpen(false)}>
                    <strong>{item.label}</strong>
                    {item.description && <span>{item.description}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      )}
    </div>
  );
});
