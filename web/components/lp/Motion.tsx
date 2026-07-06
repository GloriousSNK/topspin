"use client";

import { useEffect, useRef, type ReactNode, type CSSProperties } from "react";

/* Shared motion primitives for the landing page.
   All IntersectionObserver-driven, all reduced-motion aware. */

/** Fades + rises children into place when they enter the viewport.
    `delay` staggers siblings (ms). */
export function Reveal({ children, delay = 0, className, style }: {
  children: ReactNode; delay?: number; className?: string; style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
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

/** Counts from 0 to `to` when scrolled into view. */
export function Counter({ to, decimals = 0, suffix }: { to: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = to.toFixed(decimals);
      return;
    }
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(), dur = 1400;
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(2, -10 * p); // easeOutExpo
        el.textContent = (to * (p === 1 ? 1 : e)).toFixed(decimals);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [to, decimals]);
  return (
    <>
      <span ref={ref}>0</span>
      {suffix && <span className="u">{suffix}</span>}
    </>
  );
}

/** Buttons that lean a few pixels toward the cursor, then spring home. */
export function Magnetic({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const inner = el.firstElementChild as HTMLElement | null;
    if (!inner) return;
    inner.style.transition = "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)";
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
      const dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
      inner.style.transform = `translate(${dx * 5}px, ${dy * 4}px)`;
    };
    const leave = () => { inner.style.transform = "translate(0, 0)"; };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, []);
  return <span ref={ref} style={{ display: "inline-block" }}>{children}</span>;
}
