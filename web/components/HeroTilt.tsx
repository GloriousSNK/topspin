"use client";

import { useEffect, useRef } from "react";

/**
 * Wraps the hero visual and tilts it in 3D toward the pointer.
 * Motion is smoothed with a per-frame lerp (no CSS transition fighting it),
 * plus a faint idle sway so it feels alive at rest.
 * Children with `transform: translateZ(...)` parallax against the card.
 *
 * Cost control: the rect is measured once per hover (page coordinates, so
 * scrolling doesn't stale it) and pointermove only stores numbers. The rAF
 * loop runs only while the card is on screen and the tab is visible; with
 * reduced motion (no sway) it stops entirely once the tilt has settled.
 */
export default function HeroTilt({ children }: { children: React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrap.current;
    const card = inner.current;
    if (!el || !card) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
    let active = false;
    let left = 0, top = 0, w = 1, h = 1;
    let raf = 0, onScreen = true;
    let lastRx = NaN, lastRy = NaN;

    const measure = () => {
      const r = el.getBoundingClientRect();
      left = r.left + window.scrollX; top = r.top + window.scrollY;
      w = r.width || 1; h = r.height || 1;
    };

    const start = performance.now();
    const tick = (t: number) => {
      raf = 0;
      // ease current toward target
      cur.x += (target.x - cur.x) * 0.09;
      cur.y += (target.y - cur.y) * 0.09;
      // faint idle sway, fades out while the pointer is driving it
      const idle = reduce ? 0 : (active ? 0.25 : 1);
      const elapsed = (t - start) / 1000;
      const rx = cur.x + Math.sin(elapsed * 0.6) * 1.1 * idle;
      const ry = cur.y + Math.cos(elapsed * 0.45) * 1.4 * idle;
      const sx = rx.toFixed(2), sy = ry.toFixed(2);
      if (+sx !== lastRx || +sy !== lastRy) {
        lastRx = +sx; lastRy = +sy;
        card.style.transform = `rotateX(${sx}deg) rotateY(${sy}deg)`;
      }
      const settled = Math.abs(target.x - cur.x) < 0.01 && Math.abs(target.y - cur.y) < 0.01;
      if (reduce && settled) return; // nothing left to animate
      kick();
    };
    function kick() {
      if (!raf && onScreen && !document.hidden) raf = requestAnimationFrame(tick);
    }

    const onEnter = () => measure();
    const onMove = (e: PointerEvent) => {
      const px = (e.pageX - left) / w - 0.5;   // -0.5 .. 0.5
      const py = (e.pageY - top) / h - 0.5;
      // rotateX responds to vertical, rotateY to horizontal. Kept subtle.
      target.x = -py * 9; target.y = px * 11;
      active = true;
      kick();
    };
    const onLeave = () => {
      target.x = 0; target.y = 0;
      active = false;
      kick();
    };
    const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else kick(); };

    const io = new IntersectionObserver(([en]) => {
      onScreen = en.isIntersecting;
      if (onScreen) kick(); else { cancelAnimationFrame(raf); raf = 0; }
    });
    io.observe(el);
    measure();
    el.addEventListener("pointerenter", onEnter, { passive: true });
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    kick();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div ref={wrap} className="hero-tilt">
      <div ref={inner} className="hero-tilt-inner">
        {children}
      </div>
    </div>
  );
}
