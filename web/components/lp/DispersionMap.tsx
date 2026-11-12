"use client";

import { useEffect, useRef } from "react";

/**
 * A top-down court where your cursor is the shot intention.
 * 320 pre-seeded gaussian deviations get mapped around the aim point each
 * frame; risk (spread) grows as you aim deeper and closer to the lines, and
 * the in-percentage is recounted live. The same idea as the backend's
 * Monte-Carlo landing ensemble — rendered at 60fps under your hand.
 *
 * Frame budget: the court lines are drawn once per resize into an offscreen
 * layer and blitted; each landing dot is a pre-rendered sprite (one drawImage
 * instead of a path + fill + colour parse); the pointer handler only stores
 * coordinates against a rect measured on pointerenter; the loop sleeps when
 * offscreen, off-tab, or once the reticle has settled under a still cursor.
 */

const L = 23.77, W_HALF = 4.115, NET = 11.885;
const SERVICE_FAR = 18.285;
const DOT_R = 1.6;
const IN_FILL = "rgba(23,127,63,0.55)", OUT_FILL = "rgba(194,62,31,0.45)";
const TICKS = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;

// deterministic gaussian pairs (Box–Muller over a tiny seeded PRNG)
function seeded(n: number): [number, number][] {
  let s = 42;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const u = Math.max(rnd(), 1e-9), v = rnd();
    const m = Math.sqrt(-2 * Math.log(u));
    out.push([m * Math.cos(2 * Math.PI * v), m * Math.sin(2 * Math.PI * v)]);
  }
  return out;
}
const CLOUD = seeded(320);

function makeDot(fill: string, dpr: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  const s = Math.ceil((DOT_R * 2 + 2) * dpr);
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  g.fillStyle = fill;
  g.beginPath(); g.arc(s / 2, s / 2, DOT_R * dpr, 0, Math.PI * 2); g.fill();
  return c;
}

export default function DispersionMap() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cw = 0, ch = 0, raf = 0, visible = false, alive = true;
    let hasPointer = false;
    // aim in court coords: depth x ∈ [13, 23.4], lateral y ∈ [-4.6, 4.6]
    const aim = { x: 17.4, y: -0.8, tx: 17.4, ty: -0.8 };
    // canvas box in page coordinates (stays valid while scrolling)
    const box = { left: 0, top: 0, w: 1, h: 1 };
    let ptrX = 0, ptrY = 0, ptrDirty = false;
    let lastPct = "";

    // static layers, rebuilt on resize
    let court: HTMLCanvasElement | null = null;
    let dotIn: HTMLCanvasElement | null = null, dotOut: HTMLCanvasElement | null = null;
    let dotS = 0; // sprite size in CSS px

    // court-to-canvas: depth increases upward, only the far half + margins
    const pad = 26;
    const X0 = NET - 1.2, X1 = L + 2.2; // world depth window
    const pxX = (y: number) => cw / 2 + (y / 6.2) * (cw / 2 - pad);
    const pxY = (x: number) => ch - pad - ((x - X0) / (X1 - X0)) * (ch - pad * 2);

    function buildCourt(dpr: number) {
      const c = court ?? document.createElement("canvas");
      c.width = canvas!.width; c.height = canvas!.height;
      const g = c.getContext("2d")!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const line = (x1: number, y1: number, x2: number, y2: number, alpha: number, w = 1.2) => {
        g.strokeStyle = `rgba(29,34,27,${alpha})`;
        g.lineWidth = w;
        g.beginPath(); g.moveTo(pxX(y1), pxY(x1)); g.lineTo(pxX(y2), pxY(x2)); g.stroke();
      };
      // far half of the court
      line(NET, -5.485, NET, 5.485, 0.5, 1.8);                  // net
      line(L, -W_HALF, L, W_HALF, 0.35);                        // baseline
      line(NET, -W_HALF, L, -W_HALF, 0.3);                      // sidelines
      line(NET, W_HALF, L, W_HALF, 0.3);
      line(SERVICE_FAR, -W_HALF, SERVICE_FAR, W_HALF, 0.18);    // service line
      line(NET, 0, SERVICE_FAR, 0, 0.18);                       // centre service
      court = c;
    }

    function draw() {
      ctx!.clearRect(0, 0, cw, ch);
      if (court) ctx!.drawImage(court, 0, 0, cw, ch);

      // risk model: deeper + wider aim = bigger spread
      const depthRisk = (aim.x - 13) / 10.4;
      const lineRisk = Math.abs(aim.y) / 4.6;
      const sigY = 0.42 + depthRisk * 0.75 + lineRisk * 0.3;   // lateral σ (m)
      const sigX = 0.6 + depthRisk * 1.1;                      // depth σ (m)

      let inCount = 0;
      const half = dotS / 2;
      for (let i = 0; i < CLOUD.length; i++) {
        const g = CLOUD[i];
        const px = aim.x + g[0] * sigX;
        const py = aim.y + g[1] * sigY;
        const isIn = px <= L && px >= NET && Math.abs(py) <= W_HALF;
        if (isIn) inCount++;
        ctx!.drawImage((isIn ? dotIn : dotOut)!, pxX(py) - half, pxY(px) - half, dotS, dotS);
      }

      // aim reticle
      const ax = pxX(aim.y), ay = pxY(aim.x);
      ctx!.strokeStyle = "rgba(29,34,27,0.8)";
      ctx!.lineWidth = 1.2;
      ctx!.beginPath(); ctx!.arc(ax, ay, 9, 0, Math.PI * 2); ctx!.stroke();
      ctx!.beginPath(); // the four ticks never overlap, so one stroke is identical
      for (const [dx, dy] of TICKS) {
        ctx!.moveTo(ax + dx * 13, ay + dy * 13);
        ctx!.lineTo(ax + dx * 5, ay + dy * 5);
      }
      ctx!.stroke();

      const pct = `${Math.round((inCount / CLOUD.length) * 100)}% IN`;
      if (pct !== lastPct && pctRef.current) { pctRef.current.textContent = pct; lastPct = pct; }
    }

    function applyPointer() {
      if (!ptrDirty) return;
      ptrDirty = false;
      const nx = (ptrX - box.left) / box.w;   // 0..1
      const ny = (ptrY - box.top) / box.h;
      aim.ty = (nx - 0.5) * 9.2;
      aim.tx = X1 - 0.6 - ny * (X1 - X0 - 1.6);
    }

    function frame(t: number) {
      raf = 0;
      if (!alive || !visible || document.hidden || cw === 0) return;
      applyPointer();
      if (!hasPointer) {
        // idle: the aim slowly patrols the court like a rally pattern
        aim.tx = 17.6 + Math.sin(t * 0.00042) * 3.4;
        aim.ty = Math.sin(t * 0.00069) * 2.9;
      }
      aim.x += (aim.tx - aim.x) * 0.07;
      aim.y += (aim.ty - aim.y) * 0.07;
      draw();
      // under a still cursor the reticle converges; stop until the next move
      if (hasPointer && Math.abs(aim.tx - aim.x) < 1e-3 && Math.abs(aim.ty - aim.y) < 1e-3) return;
      raf = requestAnimationFrame(frame);
    }
    function kick() {
      if (!raf && alive && visible && !document.hidden) raf = requestAnimationFrame(frame);
    }
    // reduced motion: no loop, just one coalesced redraw per pointer frame
    function redrawReduced() {
      raf = 0;
      applyPointer();
      aim.x = aim.tx; aim.y = aim.ty;
      draw();
    }

    function measure() {
      const r = canvas!.getBoundingClientRect();
      box.left = r.left + window.scrollX; box.top = r.top + window.scrollY;
      box.w = r.width || 1; box.h = r.height || 1;
    }

    function resize(width: number) {
      if (width < 1) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cw = width; ch = width * 0.72;
      canvas!.style.height = `${ch}px`;
      canvas!.width = Math.round(cw * dpr);
      canvas!.height = Math.round(ch * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildCourt(dpr);
      dotIn = makeDot(IN_FILL, dpr);
      dotOut = makeDot(OUT_FILL, dpr);
      dotS = dotIn.width / dpr;
      draw(); // never leave a freshly-cleared buffer on screen
    }
    // RO hands us the content width without a layout read
    const ro = new ResizeObserver(([en]) => resize(en.contentRect.width));
    ro.observe(wrap);
    resize(wrap.clientWidth);

    const onEnter = (e: PointerEvent) => {
      measure(); // one layout read per hover, in an input task (layout is clean)
      onPointer(e);
    };
    const onPointer = (e: PointerEvent) => {
      hasPointer = true;
      ptrX = e.pageX; ptrY = e.pageY; ptrDirty = true;
      if (reduce) { if (!raf) raf = requestAnimationFrame(redrawReduced); }
      else kick();
    };
    const onLeave = () => { hasPointer = false; kick(); };
    const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else kick(); };

    canvas.addEventListener("pointerenter", onEnter, { passive: true });
    canvas.addEventListener("pointermove", onPointer, { passive: true });
    canvas.addEventListener("pointerleave", onLeave, { passive: true });

    let io: IntersectionObserver | null = null;
    if (!reduce) {
      io = new IntersectionObserver(([en]) => {
        visible = en.isIntersecting;
        if (visible) kick(); else { cancelAnimationFrame(raf); raf = 0; }
      }, { threshold: 0.05 });
      io.observe(wrap);
      document.addEventListener("visibilitychange", onVis);
    }
    return () => {
      alive = false; cancelAnimationFrame(raf);
      ro.disconnect(); io?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("pointerenter", onEnter);
      canvas.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div className="lp-panel">
      <div className="lp-panel-head">
        <span>Landing ensemble · 320 flights</span>
        <span className="val" aria-live="off"><span ref={pctRef}>— % IN</span></span>
      </div>
      <div className="lp-panel-body" ref={wrapRef}>
        {/* aspect-ratio reserves the final height before hydration (no shift) */}
        <canvas
          ref={canvasRef}
          style={{ aspectRatio: "25 / 18" }}
          aria-label="Interactive shot dispersion map — move your cursor to aim"
        />
      </div>
      <div className="lp-panel-foot">
        <span>MOVE CURSOR TO AIM</span>
        <span>σ GROWS WITH DEPTH + LINE PROXIMITY</span>
      </div>
    </div>
  );
}
