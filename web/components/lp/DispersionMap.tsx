"use client";

import { useEffect, useRef } from "react";

/**
 * A top-down court where your cursor is the shot intention.
 * 320 pre-seeded gaussian deviations get mapped around the aim point each
 * frame; risk (spread) grows as you aim deeper and closer to the lines, and
 * the in-percentage is recounted live. The same idea as the backend's
 * Monte-Carlo landing ensemble — rendered at 60fps under your hand.
 */

const L = 23.77, W_HALF = 4.115, NET = 11.885;
const SERVICE_FAR = 18.285;

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
    let cw = 0, ch = 0, raf = 0, visible = true, running = true;
    let hasPointer = false;
    // aim in court coords: depth x ∈ [13, 23.4], lateral y ∈ [-4.6, 4.6]
    const aim = { x: 17.4, y: -0.8, tx: 17.4, ty: -0.8 };

    // court-to-canvas: depth increases upward, only the far half + margins
    const pad = 26;
    const X0 = NET - 1.2, X1 = L + 2.2; // world depth window
    const toPx = (x: number, y: number): [number, number] => [
      cw / 2 + (y / 6.2) * (cw / 2 - pad),
      ch - pad - ((x - X0) / (X1 - X0)) * (ch - pad * 2),
    ];

    function line(a: [number, number], b: [number, number], alpha: number, w = 1.2) {
      ctx!.strokeStyle = `rgba(29,34,27,${alpha})`;
      ctx!.lineWidth = w;
      ctx!.beginPath(); ctx!.moveTo(a[0], a[1]); ctx!.lineTo(b[0], b[1]); ctx!.stroke();
    }

    function draw() {
      ctx!.clearRect(0, 0, cw, ch);
      // far half of the court
      line(toPx(NET, -5.485), toPx(NET, 5.485), 0.5, 1.8);                    // net
      line(toPx(L, -W_HALF), toPx(L, W_HALF), 0.35);                          // baseline
      line(toPx(NET, -W_HALF), toPx(L, -W_HALF), 0.3);                        // sidelines
      line(toPx(NET, W_HALF), toPx(L, W_HALF), 0.3);
      line(toPx(SERVICE_FAR, -W_HALF), toPx(SERVICE_FAR, W_HALF), 0.18);      // service line
      line(toPx(NET, 0), toPx(SERVICE_FAR, 0), 0.18);                         // centre service

      // risk model: deeper + wider aim = bigger spread
      const depthRisk = (aim.x - 13) / 10.4;
      const lineRisk = Math.abs(aim.y) / 4.6;
      const sigY = 0.42 + depthRisk * 0.75 + lineRisk * 0.3;   // lateral σ (m)
      const sigX = 0.6 + depthRisk * 1.1;                      // depth σ (m)

      let inCount = 0;
      for (const [gx, gy] of CLOUD) {
        const px = aim.x + gx * sigX;
        const py = aim.y + gy * sigY;
        const isIn = px <= L && px >= NET && Math.abs(py) <= W_HALF;
        if (isIn) inCount++;
        const [sx, sy] = toPx(px, py);
        ctx!.fillStyle = isIn ? "rgba(23,127,63,0.55)" : "rgba(194,62,31,0.45)";
        ctx!.beginPath(); ctx!.arc(sx, sy, 1.6, 0, Math.PI * 2); ctx!.fill();
      }

      // aim reticle
      const [ax, ay] = toPx(aim.x, aim.y);
      ctx!.strokeStyle = "rgba(29,34,27,0.8)";
      ctx!.lineWidth = 1.2;
      ctx!.beginPath(); ctx!.arc(ax, ay, 9, 0, Math.PI * 2); ctx!.stroke();
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        ctx!.beginPath();
        ctx!.moveTo(ax + dx * 13, ay + dy * 13);
        ctx!.lineTo(ax + dx * 5, ay + dy * 5);
        ctx!.stroke();
      }

      if (pctRef.current) pctRef.current.textContent = `${Math.round((inCount / CLOUD.length) * 100)}% IN`;
    }

    function frame(t: number) {
      if (!running || !visible) return;
      if (!hasPointer) {
        // idle: the aim slowly patrols the court like a rally pattern
        aim.tx = 17.6 + Math.sin(t * 0.00042) * 3.4;
        aim.ty = Math.sin(t * 0.00069) * 2.9;
      }
      aim.x += (aim.tx - aim.x) * 0.07;
      aim.y += (aim.ty - aim.y) * 0.07;
      draw();
      raf = requestAnimationFrame(frame);
    }

    function resize() {
      const node = wrapRef.current, cv = canvasRef.current;
      if (!node || !cv) return;
      const rect = node.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cw = rect.width; ch = rect.width * 0.72;
      cv.style.height = `${ch}px`;
      cv.width = Math.round(cw * dpr);
      cv.height = Math.round(ch * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduce) draw();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const onPointer = (e: PointerEvent) => {
      hasPointer = true;
      const rect = canvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;   // 0..1
      const ny = (e.clientY - rect.top) / rect.height;
      aim.ty = (nx - 0.5) * 9.2;
      aim.tx = X1 - 0.6 - ny * (X1 - X0 - 1.6);
      if (reduce) { aim.x = aim.tx; aim.y = aim.ty; draw(); }
    };
    const onLeave = () => { hasPointer = false; };

    canvas.addEventListener("pointermove", onPointer);
    canvas.addEventListener("pointerleave", onLeave);

    if (!reduce) {
      const io = new IntersectionObserver(([en]) => {
        visible = en.isIntersecting;
        if (visible) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
      }, { threshold: 0.05 });
      io.observe(wrap);
      raf = requestAnimationFrame(frame);
      return () => {
        running = false; cancelAnimationFrame(raf);
        ro.disconnect(); io.disconnect();
        canvas.removeEventListener("pointermove", onPointer);
        canvas.removeEventListener("pointerleave", onLeave);
      };
    }
    return () => {
      ro.disconnect();
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
        <canvas ref={canvasRef} aria-label="Interactive shot dispersion map — move your cursor to aim" />
      </div>
      <div className="lp-panel-foot">
        <span>MOVE CURSOR TO AIM</span>
        <span>σ GROWS WITH DEPTH + LINE PROXIMITY</span>
      </div>
    </div>
  );
}
