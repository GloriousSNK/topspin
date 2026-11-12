"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Lives in its own module so the layouts that mount it on every route do not
// also pull in the Learn page canvas code from Playground.tsx.
/* Site-wide: below-the-fold cards rise gently as they enter. */
/* Only cards that start BELOW the fold get the reveal. Anything already on
   screen when the page mounts is left untouched, so a page never flashes its
   visible content hidden and then fades it back in. All rects are read in one
   pass before any class is written (one layout, no read/write thrash). */
export function AutoReveal() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === "/") return; // the landing has its own choreography
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const all = document.querySelectorAll<HTMLElement>("main .card, main .lp-panel, .site section .card");
    if (!all.length) return;
    const vh = window.innerHeight;
    const below: HTMLElement[] = [];
    for (const el of all) if (el.getBoundingClientRect().top >= vh) below.push(el); // reads only
    if (!below.length) return;
    const io = new IntersectionObserver((ents) => {
      for (const en of ents) {
        if (en.isIntersecting) { en.target.classList.add("fx-in"); io.unobserve(en.target); }
      }
    }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" });
    below.forEach((el, i) => {                                                         // writes only
      el.classList.add("fx-pre");
      el.style.setProperty("--fxd", `${(i % 3) * 70}ms`);
      io.observe(el);
    });
    return () => {
      io.disconnect();
      below.forEach((el) => el.classList.remove("fx-pre", "fx-in"));
    };
  }, [pathname]);
  return null;
}
