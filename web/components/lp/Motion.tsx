"use client";

import { useEffect, useRef, type ReactNode, type CSSProperties } from "react";

/* Shared motion primitives for the landing page.
   All IntersectionObserver-driven, all reduced-motion aware. */

/** Fades + rises children into place when they enter the viewport.
    `delay` staggers siblings (ms). The observer's first callback fires on the
    next frame, so anything already in view on mount reveals straight away. */
export function Reveal({ children, delay = 0, className, style }: {
  children: ReactNode; delay?: number; className?: string; style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(([en]) => {
      if (en.isIntersecting) { el.classList.add("is-in"); io.disconnect(); }
    }, { threshold: 0.18, rootMargin: "0px 0px -40px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} data-reveal className={className} style={{ ...style, ["--rd" as string]: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** Counts up to `to` when scrolled into view. If `to` changes later (e.g. a
    live number arrives after fetch), it eases from the current value to the new
    one, so the band never snaps or shows a stale figure. */
export function Counter({ to, decimals = 0, suffix }: { to: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);   // value currently on screen
  const seen = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = to.toFixed(decimals);
      from.current = to;
      return;
    }
    let raf = 0;
    let io: IntersectionObserver | null = null;
    const run = () => {
      const start = from.current, t0 = performance.now(), dur = 1200;
      let last = "";
      const tick = (t: number) => {
        const p = Math.min(1, Math.max(0, (t - t0) / dur));
        const e = 1 - Math.pow(2, -10 * p); // easeOutExpo
        const v = start + (to - start) * (p === 1 ? 1 : e);
        from.current = v; // an interrupted count resumes from what is shown
        const s = v.toFixed(decimals);
        if (s !== last) { el.textContent = s; last = s; } // skip no-op text writes
        if (p < 1) raf = requestAnimationFrame(tick);
        else raf = 0;
      };
      raf = requestAnimationFrame(tick);
    };
    if (seen.current) run(); // already visible: just re-run to the new target
    else {
      io = new IntersectionObserver(([en]) => {
        if (!en.isIntersecting) return;
        seen.current = true;
        io?.disconnect();
        run();
      }, { threshold: 0.5 });
      io.observe(el);
    }
    return () => { io?.disconnect(); cancelAnimationFrame(raf); };
  }, [to, decimals]);
  return (
    <>
      <span ref={ref}>0</span>
      {suffix && <span className="u">{suffix}</span>}
    </>
  );
}

/** Buttons that lean a few pixels toward the cursor, then spring home.
 *
 *  The lean is applied to this wrapper span, never to the button itself, so the
 *  button keeps its own CSS hover/press transform and transitions (an inline
 *  transition on the button used to override them and make every hover and
 *  click feel floaty). The rect is measured once on pointerenter in page
 *  coordinates, pointermove only stores coordinates, and the single transform
 *  write happens in the next animation frame. Nothing here touches click
 *  handling, and the lean is small enough that the target never leaves the
 *  cursor. */
export function Magnetic({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // page-space box of the un-shifted wrapper, measured on enter
    let left = 0, top = 0, hw = 1, hh = 1;
    let curX = 0, curY = 0;          // current applied offset (px)
    let px = 0, py = 0, raf = 0, inside = false;

    const apply = () => {
      raf = 0;
      let dx = 0, dy = 0;
      if (inside) {
        dx = Math.max(-1, Math.min(1, (px - left - hw) / hw)) * 3;
        dy = Math.max(-1, Math.min(1, (py - top - hh) / hh)) * 2.5;
      }
      if (dx === curX && dy === curY) return;
      curX = dx; curY = dy;
      el.style.transform = dx || dy ? `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)` : "";
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(apply); };

    const enter = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      // one layout read per hover; subtract the offset we may still be applying
      const r = el.getBoundingClientRect();
      left = r.left - curX + window.scrollX;
      top = r.top - curY + window.scrollY;
      hw = r.width / 2 || 1; hh = r.height / 2 || 1;
      inside = true;
      px = e.pageX; py = e.pageY;
      schedule();
    };
    const move = (e: PointerEvent) => {
      if (!inside || e.pointerType !== "mouse") return;
      px = e.pageX; py = e.pageY;
      schedule();
    };
    const leave = () => { inside = false; schedule(); };

    el.addEventListener("pointerenter", enter, { passive: true });
    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerleave", leave, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      el.style.transform = "";
    };
  }, []);
  return (
    <span
      ref={ref}
      style={{ display: "inline-block", transition: "transform 0.16s cubic-bezier(0.22, 1, 0.36, 1)" }}
    >
      {children}
    </span>
  );
}
