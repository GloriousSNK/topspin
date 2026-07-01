"use client";

import { useEffect, useRef } from "react";

/**
 * Wraps the hero visual and tilts it in 3D toward the pointer.
 * Motion is smoothed with a per-frame lerp (no CSS transition fighting it),
 * plus a faint always-on idle sway so it feels alive at rest.
 * Children with `transform: translateZ(...)` parallax against the card.
 */
export default function HeroTilt({ children }: { children: React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const cur = useRef({ x: 0, y: 0 });
  const active = useRef(false);

  useEffect(() => {
    const el = wrap.current;
    const card = inner.current;
    if (!el || !card) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;   // -0.5 .. 0.5
      const py = (e.clientY - r.top) / r.height - 0.5;
      // rotateX responds to vertical, rotateY to horizontal. Kept subtle.
      target.current = { x: -py * 9, y: px * 11 };
      active.current = true;
    };
    const onLeave = () => {
      target.current = { x: 0, y: 0 };
      active.current = false;
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);

    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      // ease current toward target
      cur.current.x += (target.current.x - cur.current.x) * 0.09;
      cur.current.y += (target.current.y - cur.current.y) * 0.09;
      // faint idle sway, fades out while the pointer is driving it
      const idle = reduce ? 0 : (active.current ? 0.25 : 1);
      const elapsed = (t - start) / 1000;
      const swayX = Math.sin(elapsed * 0.6) * 1.1 * idle;
      const swayY = Math.cos(elapsed * 0.45) * 1.4 * idle;
      const rx = cur.current.x + swayX;
      const ry = cur.current.y + swayY;
      card.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
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
