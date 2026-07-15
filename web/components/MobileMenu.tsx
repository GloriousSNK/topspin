"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
  description?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

interface MobileMenuProps {
  groups: NavGroup[];
  account: NavItem;
  identity: { email: string; role: string } | null;
  loading: boolean;
}

function active(path: string, href: string): boolean {
  const [route, fragment] = href.split("#");
  if (fragment) return false;
  return path === route || path.startsWith(`${route}/`);
}

export default function MobileMenu({ groups, account, identity, loading }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const media = window.matchMedia("(min-width: 981px)");
    const resize = () => { if (media.matches) setOpen(false); };
    document.addEventListener("keydown", key);
    media.addEventListener("change", resize);
    return () => {
      document.removeEventListener("keydown", key);
      media.removeEventListener("change", resize);
    };
  }, [open]);

  return (
    <div className="mobile-menu">
      <button
        ref={button}
        className={`hamburger ${open ? "open" : ""}`}
        type="button"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls="mobile-navigation"
        onClick={() => setOpen((value) => !value)}
      >
        <span /><span /><span />
      </button>
      {open && (
        <>
          <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />
          <nav id="mobile-navigation" className="mobile-panel" aria-label="Mobile navigation">
            {loading ? (
              <div className="mobile-identity mobile-identity-loading">Loading account...</div>
            ) : identity ? (
              <div className="mobile-identity">
                <span className="nav-avatar" aria-hidden="true">{identity.email.charAt(0).toUpperCase()}</span>
                <span><strong>{identity.email}</strong><small>{identity.role}</small></span>
              </div>
            ) : null}
            <div className="mobile-nav-groups">
              {groups.map((group) => (
                <div className="mobile-nav-group" key={group.label}>
                  <span className="nav-group-label">{group.label}</span>
                  {group.items.map((item) => {
                    const current = active(path, item.href);
                    return (
                      <Link key={item.href} href={item.href} className={current ? "active" : ""} aria-current={current ? "page" : undefined} onClick={() => setOpen(false)}>
                        <span>{item.label}</span>
                        {item.description && <small>{item.description}</small>}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
            {!loading && (
              <Link href={account.href} className={`mobile-account-link ${active(path, account.href) ? "active" : ""}`} aria-current={active(path, account.href) ? "page" : undefined} onClick={() => setOpen(false)}>
                {account.label}
              </Link>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
