"use client";

import { useState } from "react";
import Link from "next/link";

export interface MobileLink {
  href: string;
  label: string;
}

export default function MobileMenu({ links, cta }: { links: MobileLink[]; cta?: MobileLink }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mobile-menu" style={{ position: "static" }}>
      <button
        className="hamburger"
        aria-label="Toggle menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span /><span /><span />
      </button>
      {open && (
        <div className="mobile-panel">
          {links.map((l) =>
            l.href.includes("#") ? (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>
            ) : (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</Link>
            )
          )}
          {cta && (
            <Link href={cta.href} className="btn" onClick={() => setOpen(false)}>
              {cta.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
