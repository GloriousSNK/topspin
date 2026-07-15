"use client";

import { useEffect, useRef, useState } from "react";
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
  { href: "/coach", label: "Roster" },
  { href: "/analyze", label: "Analyse" },
  { href: "/workouts", label: "Practice" },
  { href: "/stats", label: "Stats" },
];

const EXPLORE: NavItem[] = [
  { href: "/learn", label: "Learn", description: "The physics behind the ball" },
  { href: "/insights", label: "Insights", description: "Live, anonymous platform totals" },
  { href: "/about", label: "About", description: "Why TopSpin exists" },
];

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
  const moreGroups: NavGroup[] = isCoach ? [
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
  ] : [
    {
      label: "Analysis",
      items: [{ href: "/batch", label: "Batch analysis", description: "Queue several clips" }],
    },
    { label: "Explore", items: EXPLORE },
  ];
  const mobileGroups: NavGroup[] = [
    { label: isCoach ? "Coach workspace" : "Train", items: primary },
    ...moreGroups,
  ];
  const initial = (user?.email ?? "?").charAt(0).toUpperCase();

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
                <span className="nav-role">{isCoach ? "Coach" : role === "player" ? "Player" : "Account"}</span>
              </span>
            </Link>
          ) : (
            <Link href="/account" className="btn btn-ghost nav-signin">Sign in</Link>
          )}
          <MobileMenu
            groups={mobileGroups}
            account={{ href: "/account", label: user ? "Account settings" : "Sign in or create account" }}
            identity={user ? { email: user.email ?? "Signed in", role: isCoach ? "Coach" : role === "player" ? "Player" : "Account" } : null}
            loading={loading}
          />
        </div>
      </div>
    </header>
  );
}

function MoreMenu({ groups, path }: { groups: NavGroup[]; path: string }) {
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
}
