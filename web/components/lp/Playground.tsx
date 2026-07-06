"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/* Scroll-driven physics for the Learn page.
   No controls, no sliders — the simulations are integrated up front with the
   backend's drag + Magnus model, then *drawn by your scroll*. Scrub down and
   the ball flies; scrub up and it rewinds. */

const G = 9.81, RHO = 1.21, CD = 0.55, R = 0.0335, M = 0.057;
const AREA = Math.PI * R * R;
const NET_X = 11.885, NET_H = 1.0, BASE_X = 23.77;
const RPM = (2 * Math.PI) / 60;

type P2 = [number, number];

/** Integrate one side-view shot. mode: 0 = vacuum, 1 = drag only, 2 = drag+Magnus. */
function fly(speed: number, elevDeg: number, spinRpm: number, mode: 0 | 1 | 2, h0 = 1.0): P2[] {
  const e = (elevDeg * Math.PI) / 180;
  let x = 0, z = h0, vx = speed * Math.cos(e), vz = speed * Math.sin(e);
  const w = spinRpm * RPM;
  const dt = 1 / 240;
  const pts: P2[] = [[x, z]];
  for (let i = 0; i < 2400 && z > 0 && x < 40; i++) {
    const v = Math.hypot(vx, vz);
    let ax = 0, az = -G;
    if (mode >= 1 && v > 1e-9) {
      const k = (0.5 * RHO * CD * AREA * v) / M;
      ax -= k * vx; az -= k * vz;
    }
    if (mode === 2 && v > 1e-9 && Math.abs(w) > 1e-9) {
      const ratio = (R * Math.abs(w)) / v;
      const cl = (ratio / (2 + ratio)) * 0.9;
      const mk = (0.5 * RHO * cl * AREA * v * v) / M / v;
      ax += mk * vz * Math.sign(w);
      az += mk * -vx * Math.sign(w);
    }
    vx += ax * dt; vz += az * dt;
    x += vx * dt; z += vz * dt;
    pts.push([x, Math.max(0, z)]);
  }
  return pts;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Scrubs a callback with 0→1 progress as the element crosses the viewport. */
function useScrub(ref: React.RefObject<HTMLElement | null>, cb: (p: number) => void) {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    let raf = 0, last = -1;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { cbRef.current(1); return; }
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        const p = Math.min(1, Math.max(0, (vh * 0.92 - r.top) / (vh * 0.72)));
        if (Math.abs(p - last) < 0.002) return;
        last = p;
        cbRef.current(p);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref]);
}

function setupCanvas(wrap: HTMLDivElement, canvas: HTMLCanvasElement) {
  const rect = wrap.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = rect.width, h = rect.width * 0.52;
  canvas.style.height = `${h}px`;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function courtFrame(ctx: CanvasRenderingContext2D, w: number, h: number, X: (x: number) => number, Y: (z: number) => number) {
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(29,34,27,0.45)"; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(X(-1), Y(0)); ctx.lineTo(X(27), Y(0)); ctx.stroke();
  ctx.strokeStyle = "rgba(29,34,27,0.6)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(X(NET_X), Y(0)); ctx.lineTo(X(NET_X), Y(NET_H)); ctx.stroke();
  ctx.strokeStyle = "rgba(29,34,27,0.35)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(X(BASE_X), Y(0)); ctx.lineTo(X(BASE_X), Y(0.28)); ctx.stroke();
  ctx.font = "9.5px ui-monospace, monospace";
  ctx.fillStyle = "rgba(29,34,27,0.55)";
  ctx.fillText("NET", X(NET_X) - 10, Y(NET_H) - 6);
  ctx.fillText("BASELINE", X(BASE_X) - 24, Y(0.28) - 6);
}

function trace(ctx: CanvasRenderingContext2D, pts: P2[], upto: number, X: (x: number) => number, Y: (z: number) => number, style: string, width: number, dash?: number[]) {
  const n = Math.max(2, Math.min(pts.length, Math.floor(pts.length * upto)));
  ctx.strokeStyle = style; ctx.lineWidth = width;
  ctx.setLineDash(dash ?? []);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const px = X(pts[i][0]), py = Y(pts[i][1]);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  return pts[n - 1];
}

/* ================= 1. Break the parabola (scroll-drawn) ================= */
export function ScrollFlight() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const gapRef = useRef<HTMLSpanElement>(null);

  const sim = useRef<{ vac: P2[]; drag: P2[]; real: P2[] } | null>(null);
  if (!sim.current) sim.current = { vac: fly(32, 10, 0, 0), drag: fly(32, 10, 0, 1), real: fly(32, 10, 2200, 2) };
  const { vac, drag, real } = sim.current;
  const finalGap = vac[vac.length - 1][0] - real[real.length - 1][0];

  useScrub(panelRef, (p) => {
    const wrap = wrapRef.current, canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const { ctx, w, h } = setupCanvas(wrap, canvas);
    if (!ctx) return;
    const pad = 20;
    const X = (x: number) => pad + ((x + 1) / 34) * (w - pad * 2);
    const Y = (z: number) => h - 24 - (z / 9) * (h - 44);
    courtFrame(ctx, w, h, X, Y);
    const e = easeOut(p);
    // the three physics draw in sequence: fantasy first, then air, then spin
    const tipV = trace(ctx, vac, Math.min(1, e * 1.5), X, Y, "rgba(29,34,27,0.3)", 1.4, [4, 5]);
    const tipD = trace(ctx, drag, Math.min(1, Math.max(0, e * 1.5 - 0.18)), X, Y, "rgba(46,109,168,0.65)", 1.8);
    const tipR = trace(ctx, real, Math.min(1, Math.max(0, e * 1.5 - 0.36)), X, Y, "#17673a", 2.6);
    // moving balls at each tip
    for (const [tip, c, r] of [[tipV, "rgba(29,34,27,0.35)", 3], [tipD, "rgba(46,109,168,0.85)", 3.4], [tipR, "#17673a", 4.2]] as const) {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(X(tip[0]), Y(tip[1]), r, 0, Math.PI * 2); ctx.fill();
    }
    if (gapRef.current) {
      const g = finalGap * Math.min(1, Math.max(0, e * 1.5 - 0.36));
      gapRef.current.textContent = `${g.toFixed(1)} M`;
    }
  });

  return (
    <div className="lp-panel" ref={panelRef}>
      <div className="lp-panel-head">
        <span>One swing · three physics</span>
        <span className="val">PARABOLA LIES BY <span ref={gapRef}>0.0 M</span></span>
      </div>
      <div style={{ padding: "18px 18px 10px" }} ref={wrapRef}>
        <canvas ref={canvasRef} aria-label="The same swing drawn three ways: vacuum parabola, with drag, and with drag plus spin" />
      </div>
      <div className="lp-panel-foot">
        <span style={{ color: "rgba(29,34,27,0.45)" }}>· · · TEXTBOOK</span>
        <span style={{ color: "var(--court)" }}>— + AIR</span>
        <span style={{ color: "var(--green)" }}>— + SPIN</span>
        <span>DRAWN BY YOUR SCROLL</span>
      </div>
    </div>
  );
}

/* ================= 2. Chaos twins (scroll-flown) ================= */
export function ChaosScroll() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const sepRef = useRef<HTMLSpanElement>(null);

  const sim = useRef<{ a: P2[]; b: P2[] } | null>(null);
  if (!sim.current) sim.current = { a: fly(31, 9, 2000, 2), b: fly(31, 9.35, 2000, 2) };
  const { a, b } = sim.current;

  useScrub(panelRef, (p) => {
    const wrap = wrapRef.current, canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const { ctx, w, h } = setupCanvas(wrap, canvas);
    if (!ctx) return;
    const pad = 20;
    const X = (x: number) => pad + ((x + 1) / 30) * (w - pad * 2);
    const Y = (z: number) => h - 24 - (z / 9) * (h - 44);
    courtFrame(ctx, w, h, X, Y);
    const e = easeOut(p);
    const pa = trace(ctx, a, e, X, Y, "#17673a", 2.4);
    const pb = trace(ctx, b, e, X, Y, "#c23e1f", 2.4);
    // the growing gap, made visible
    ctx.strokeStyle = "rgba(29,34,27,0.5)"; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(X(pa[0]), Y(pa[1])); ctx.lineTo(X(pb[0]), Y(pb[1])); ctx.stroke();
    ctx.setLineDash([]);
    for (const [pt, c] of [[pa, "#17673a"], [pb, "#c23e1f"]] as const) {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(X(pt[0]), Y(pt[1]), 4.4, 0, Math.PI * 2); ctx.fill();
    }
    const sep = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
    if (sepRef.current) sepRef.current.textContent = sep < 1 ? `${(sep * 100).toFixed(0)} CM` : `${sep.toFixed(2)} M`;
  });

  const finalSep = Math.hypot(a[a.length - 1][0] - b[b.length - 1][0], a[a.length - 1][1] - b[b.length - 1][1]);

  return (
    <div className="lp-panel" ref={panelRef}>
      <div className="lp-panel-head">
        <span>Two “identical” shots</span>
        <span className="val">GAP <span ref={sepRef}>0 CM</span></span>
      </div>
      <div style={{ padding: "18px 18px 10px" }} ref={wrapRef}>
        <canvas ref={canvasRef} aria-label="Two nearly identical shots pulling apart in flight as you scroll" />
      </div>
      <div className="lp-panel-foot">
        <span>LAUNCHED 0.35° APART</span>
        <span>THEY LAND {finalSep < 1 ? `${(finalSep * 100).toFixed(0)} CM` : `${finalSep.toFixed(1)} M`} APART</span>
      </div>
    </div>
  );
}

/* ================= site-wide: cards rise gently as they enter ================= */
export function AutoReveal() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === "/") return; // the landing has its own choreography
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>("main .card, main .lp-panel, .site section .card"));
    if (!els.length) return;
    const io = new IntersectionObserver((ents) => {
      for (const en of ents) {
        if (en.isIntersecting) { en.target.classList.add("fx-in"); io.unobserve(en.target); }
      }
    }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" });
    els.forEach((el, i) => {
      el.classList.add("fx-pre");
      el.style.setProperty("--fxd", `${(i % 3) * 70}ms`);
      io.observe(el);
    });
    return () => {
      io.disconnect();
      els.forEach((el) => el.classList.remove("fx-pre", "fx-in"));
    };
  }, [pathname]);
  return null;
}
