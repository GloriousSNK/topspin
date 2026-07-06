"use client";

import { useEffect, useRef } from "react";

/**
 * The hero is not a video and not a tween — it's the product.
 * A perspective wireframe court with tennis balls integrated in real time
 * under gravity + quadratic drag + Magnus lift (the same model the backend
 * uses), a fading flight trail, a landing dispersion cloud, ripples on
 * impact, and a telemetry HUD reading live values out of the simulation.
 * Pointer moves the camera a few degrees. Pauses offscreen and off-tab.
 */

// ---- physics constants (mirrors ml-service/app/core/ball_physics.py) ----
const G = 9.81, RHO = 1.21, CD = 0.55, R = 0.0335, M = 0.057;
const AREA = Math.PI * R * R;
const COURT_L = 23.77, COURT_W_HALF = 4.115, DOUBLES_HALF = 5.485;
const NET_X = 11.885, NET_H = 1.0;
const SERVICE_NEAR = 5.485, SERVICE_FAR = 18.285;

type V3 = [number, number, number];

function accel(v: V3, w: V3): V3 {
  const speed = Math.hypot(v[0], v[1], v[2]);
  const a: V3 = [0, 0, -G];
  if (speed < 1e-9) return a;
  const dragK = (0.5 * RHO * CD * AREA * speed) / M;
  a[0] -= dragK * v[0]; a[1] -= dragK * v[1]; a[2] -= dragK * v[2];
  // Magnus: 0.5 rho Cl A |v|^2 * (w x v)/|w x v|
  const cx = w[1] * v[2] - w[2] * v[1];
  const cy = w[2] * v[0] - w[0] * v[2];
  const cz = w[0] * v[1] - w[1] * v[0];
  const cn = Math.hypot(cx, cy, cz);
  if (cn > 1e-9) {
    const spinRate = Math.hypot(w[0], w[1], w[2]);
    const ratio = (R * spinRate) / speed;
    const cl = (ratio / (2 + ratio)) * 0.9;
    const mk = (0.5 * RHO * cl * AREA * speed * speed) / M / cn;
    a[0] += mk * cx; a[1] += mk * cy; a[2] += mk * cz;
  }
  return a;
}

interface Ball {
  p: V3; v: V3; w: V3;
  trail: V3[];
  live: boolean;
  wait: number;            // frames to wait before relaunch
}
interface Mark { x: number; y: number; in: boolean; age: number; }
interface Ripple { x: number; y: number; t: number; in: boolean; }

export default function PhysicsHero() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vRef = useRef<HTMLSpanElement>(null);
  const spinRef = useRef<HTMLSpanElement>(null);
  const apexRef = useRef<HTMLSpanElement>(null);
  const callRef = useRef<HTMLSpanElement>(null);
  const shotRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, dpr = 1;
    let raf = 0, running = true, visible = true;

    // ---- camera (pointer-steered, critically damped) ----
    const cam = { y: 0, z: 2.6, ty: 0, tz: 2.6 };
    const CAMX = -7.5;
    const fl = () => W * 0.78;

    function project(p: V3): [number, number, number] {
      const dx = p[0] - CAMX, dy = p[1] - cam.y, dz = p[2] - cam.z;
      const s = fl() / dx;
      return [W / 2 + dy * s, H * 0.46 - dz * s, dx];
    }

    // ---- court wireframe segments ----
    const segs: [V3, V3][] = [];
    const seg = (a: V3, b: V3) => segs.push([a, b]);
    // doubles + singles sidelines, baselines
    for (const y of [-DOUBLES_HALF, -COURT_W_HALF, COURT_W_HALF, DOUBLES_HALF])
      seg([0, y, 0], [COURT_L, y, 0]);
    seg([0, -DOUBLES_HALF, 0], [0, DOUBLES_HALF, 0]);
    seg([COURT_L, -DOUBLES_HALF, 0], [COURT_L, DOUBLES_HALF, 0]);
    // service lines + centre service line
    seg([SERVICE_NEAR, -COURT_W_HALF, 0], [SERVICE_NEAR, COURT_W_HALF, 0]);
    seg([SERVICE_FAR, -COURT_W_HALF, 0], [SERVICE_FAR, COURT_W_HALF, 0]);
    seg([SERVICE_NEAR, 0, 0], [SERVICE_FAR, 0, 0]);
    // centre marks
    seg([0, 0, 0], [0.35, 0, 0]);
    seg([COURT_L - 0.35, 0, 0], [COURT_L, 0, 0]);

    // ---- state ----
    const balls: Ball[] = [
      { p: [0, 0, 1], v: [0, 0, 0], w: [0, 0, 0], trail: [], live: false, wait: 10 },
      { p: [0, 0, 1], v: [0, 0, 0], w: [0, 0, 0], trail: [], live: false, wait: 140 },
    ];
    const marks: Mark[] = [];
    const ripples: Ripple[] = [];
    let shotNo = 0;
    let apex = 0;

    function launch(b: Ball) {
      shotNo += 1;
      const y0 = (Math.random() - 0.5) * 5;
      const speed = 23 + Math.random() * 11;                  // m/s
      const elev = (5 + Math.random() * 9) * (Math.PI / 180);
      const azim = Math.atan2((Math.random() - 0.5) * 6 - y0 * 0.6, 22);
      b.p = [0.4, y0, 0.9 + Math.random() * 0.5];
      b.v = [
        speed * Math.cos(elev) * Math.cos(azim),
        speed * Math.cos(elev) * Math.sin(azim),
        speed * Math.sin(elev),
      ];
      const topspin = 120 + Math.random() * 200;              // rad/s
      const side = (Math.random() - 0.5) * 60;
      b.w = [0, topspin, side];
      b.trail = [];
      b.live = true;
      apex = b.p[2];
      // telemetry: launch values
      if (vRef.current) vRef.current.textContent = (speed * 3.6).toFixed(0);
      if (spinRef.current) spinRef.current.textContent = ((topspin * 60) / (2 * Math.PI)).toFixed(0);
      if (shotRef.current) shotRef.current.textContent = String(shotNo).padStart(3, "0");
      if (callRef.current) { callRef.current.textContent = "· · ·"; callRef.current.className = "lp-tele-v"; }
    }

    function land(b: Ball) {
      const isIn = b.p[0] >= 0 && b.p[0] <= COURT_L && Math.abs(b.p[1]) <= COURT_W_HALF;
      marks.push({ x: b.p[0], y: b.p[1], in: isIn, age: 0 });
      if (marks.length > 70) marks.shift();
      ripples.push({ x: b.p[0], y: b.p[1], t: 0, in: isIn });
      if (callRef.current) {
        callRef.current.textContent = isIn ? "IN" : "OUT";
        callRef.current.className = `lp-tele-v ${isIn ? "in" : "out"}`;
      }
      if (apexRef.current) apexRef.current.textContent = apex.toFixed(1);
      b.live = false;
      b.wait = 55 + Math.random() * 70;
    }

    const DT = 1 / 200;
    function step(b: Ball) {
      // RK2 midpoint × 3 substeps per frame ≈ real-time flight
      for (let i = 0; i < 3; i++) {
        const a1 = accel(b.v, b.w);
        const vm: V3 = [b.v[0] + a1[0] * DT * 0.5, b.v[1] + a1[1] * DT * 0.5, b.v[2] + a1[2] * DT * 0.5];
        const a2 = accel(vm, b.w);
        const nz = b.p[2] + vm[2] * DT;
        if (nz <= 0 && b.p[2] > 0) {
          const f = b.p[2] / (b.p[2] - nz);
          b.p = [b.p[0] + vm[0] * DT * f, b.p[1] + vm[1] * DT * f, 0];
          land(b);
          return;
        }
        b.p = [b.p[0] + vm[0] * DT, b.p[1] + vm[1] * DT, nz];
        b.v = [b.v[0] + a2[0] * DT, b.v[1] + a2[1] * DT, b.v[2] + a2[2] * DT];
      }
      if (b.p[2] > apex) apex = b.p[2];
      b.trail.push([...b.p] as V3);
      if (b.trail.length > 110) b.trail.shift();
      if (b.p[0] > 40 || Math.abs(b.p[1]) > 20) { b.live = false; b.wait = 30; } // safety
    }

    // ---- drawing ----
    function chalk(alpha: number, width: number) {
      ctx!.strokeStyle = `rgba(29, 34, 27, ${alpha})`;
      ctx!.lineWidth = width;
    }

    function drawCourt() {
      // depth-fogged chalk lines: nearer lines brighter
      for (const [a, b] of segs) {
        const [x1, y1, d1] = project(a);
        const [x2, y2, d2] = project(b);
        const fog = Math.max(0.1, Math.min(0.45, 9.5 / ((d1 + d2) / 2)));
        chalk(fog, 1.3);
        ctx!.beginPath(); ctx!.moveTo(x1, y1); ctx!.lineTo(x2, y2); ctx!.stroke();
      }
      // net: top cord, band posts, mesh verticals
      const [nx1, ny1] = project([NET_X, -DOUBLES_HALF - 0.3, NET_H]);
      const [nx2, ny2] = project([NET_X, DOUBLES_HALF + 0.3, NET_H]);
      chalk(0.5, 1.6);
      ctx!.beginPath(); ctx!.moveTo(nx1, ny1); ctx!.lineTo(nx2, ny2); ctx!.stroke();
      chalk(0.16, 1);
      for (let y = -5; y <= 5; y += 1.25) {
        const [tx, ty] = project([NET_X, y, NET_H]);
        const [bx, by] = project([NET_X, y, 0]);
        ctx!.beginPath(); ctx!.moveTo(tx, ty); ctx!.lineTo(bx, by); ctx!.stroke();
      }
    }

    function drawMarks() {
      for (const m of marks) {
        m.age += 1;
        const fade = Math.max(0, 1 - m.age / 1400);
        if (fade <= 0) continue;
        const [x, y, d] = project([m.x, m.y, 0]);
        const r = Math.max(1.4, 26 / d);
        ctx!.fillStyle = m.in
          ? `rgba(23, 127, 63, ${0.5 * fade})`
          : `rgba(194, 62, 31, ${0.5 * fade})`;
        ctx!.beginPath(); ctx!.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2); ctx!.fill();
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.t += 0.028;
        if (rp.t >= 1) { ripples.splice(i, 1); continue; }
        const [x, y, d] = project([rp.x, rp.y, 0]);
        const rr = (rp.t * 130) / (d * 0.55);
        ctx!.strokeStyle = rp.in
          ? `rgba(23, 127, 63, ${0.5 * (1 - rp.t)})`
          : `rgba(194, 62, 31, ${0.45 * (1 - rp.t)})`;
        ctx!.lineWidth = 1.4;
        ctx!.beginPath(); ctx!.ellipse(x, y, rr, rr * 0.45, 0, 0, Math.PI * 2); ctx!.stroke();
      }
    }

    function drawBall(b: Ball) {
      // trail — glow pass then core pass
      if (b.trail.length > 2) {
        for (const pass of [
          { w: 5, a: 0.05 },
          { w: 1.6, a: 0.5 },
        ]) {
          ctx!.lineWidth = pass.w;
          ctx!.beginPath();
          for (let i = 0; i < b.trail.length; i++) {
            const [x, y] = project(b.trail[i]);
            if (i === 0) ctx!.moveTo(x, y); else ctx!.lineTo(x, y);
          }
          ctx!.strokeStyle = `rgba(133, 154, 22, ${pass.a})`;
          ctx!.stroke();
        }
      }
      if (!b.live) return;
      const [x, y, d] = project(b.p);
      const r = Math.max(2, 42 / d);
      // ground shadow
      const [sx, sy, sd] = project([b.p[0], b.p[1], 0]);
      ctx!.fillStyle = `rgba(0,0,0,${Math.min(0.4, 3 / sd + b.p[2] * -0.02 + 0.25)})`;
      ctx!.beginPath(); ctx!.ellipse(sx, sy, r * 0.9, r * 0.4, 0, 0, Math.PI * 2); ctx!.fill();
      // ball with glow
      const g = ctx!.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r * 2.4);
      g.addColorStop(0, "rgba(222, 244, 80, 1)");
      g.addColorStop(0.4, "rgba(174, 199, 32, 0.95)");
      g.addColorStop(1, "rgba(174, 199, 32, 0)");
      ctx!.fillStyle = g;
      ctx!.beginPath(); ctx!.arc(x, y, r * 2.4, 0, Math.PI * 2); ctx!.fill();
    }

    function frame() {
      if (!running || !visible) return;
      cam.y += (cam.ty - cam.y) * 0.045;
      cam.z += (cam.tz - cam.z) * 0.045;
      ctx!.clearRect(0, 0, W, H);
      drawCourt();
      drawMarks();
      for (const b of balls) {
        if (b.live) step(b);
        else if (--b.wait <= 0) launch(b);
        drawBall(b);
      }
      raf = requestAnimationFrame(frame);
    }

    // ---- static fallback: one precomputed trajectory, no animation ----
    function drawStatic() {
      ctx!.clearRect(0, 0, W, H);
      drawCourt();
      const b: Ball = { p: [0.4, -1.2, 1.1], v: [0, 0, 0], w: [0, 190, 20], trail: [], live: true, wait: 0 };
      const sp = 28, el = 9 * (Math.PI / 180);
      b.v = [sp * Math.cos(el), 1.2, sp * Math.sin(el)];
      for (let i = 0; i < 3000 && b.live; i++) step(b);
      for (let i = 0; i < 14; i++)
        marks.push({ x: 17 + (Math.random() - 0.5) * 3.4, y: -0.4 + (Math.random() - 0.5) * 2.6, in: Math.random() > 0.18, age: 0 });
      drawMarks();
      drawBall(b);
      if (vRef.current) vRef.current.textContent = (sp * 3.6).toFixed(0);
      if (spinRef.current) spinRef.current.textContent = "1814";
      if (apexRef.current) apexRef.current.textContent = "2.6";
      if (shotRef.current) shotRef.current.textContent = "001";
      if (callRef.current) { callRef.current.textContent = "IN"; callRef.current.className = "lp-tele-v in"; }
    }

    // ---- wiring ----
    function resize() {
      const node = wrapRef.current;
      if (!node || !canvas) return;
      const rect = node.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = rect.width; H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduce) drawStatic();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    // the canvas layer is pointer-events:none so the hero CTAs stay clickable;
    // steer the camera from window-level moves instead
    const onPointer = (e: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      if (e.clientY < rect.top || e.clientY > rect.bottom) { cam.ty = 0; cam.tz = 2.6; return; }
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      cam.ty = px * 2.4;
      cam.tz = 2.6 - py * 0.9;
    };

    if (!reduce) {
      window.addEventListener("pointermove", onPointer, { passive: true });
      const io = new IntersectionObserver(([en]) => {
        visible = en.isIntersecting;
        if (visible && running) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
      }, { threshold: 0.02 });
      io.observe(wrap);
      const onVis = () => {
        if (document.hidden) { running = false; cancelAnimationFrame(raf); }
        else { running = true; if (visible) raf = requestAnimationFrame(frame); }
      };
      document.addEventListener("visibilitychange", onVis);
      raf = requestAnimationFrame(frame);
      return () => {
        running = false;
        cancelAnimationFrame(raf);
        ro.disconnect(); io.disconnect();
        window.removeEventListener("pointermove", onPointer);
        document.removeEventListener("visibilitychange", onVis);
      };
    }
    return () => ro.disconnect();
  }, []);

  return (
    <>
      <div ref={wrapRef} className="lp-hero-canvas" aria-hidden="true">
        <canvas ref={canvasRef} />
      </div>
      <div className="lp-telemetry lp-tick-b" role="status" aria-label="Live simulation telemetry">
        <div className="lp-telemetry-head">
          <span><span className="lp-live-dot" />Live simulation</span>
          <span>SHOT <span ref={shotRef}>001</span></span>
        </div>
        <div className="lp-telemetry-grid">
          <div className="lp-tele-item">
            <span className="lp-tele-k">Launch speed</span>
            <span className="lp-tele-v"><span ref={vRef}>—</span><span className="u">km/h</span></span>
          </div>
          <div className="lp-tele-item">
            <span className="lp-tele-k">Topspin</span>
            <span className="lp-tele-v"><span ref={spinRef}>—</span><span className="u">rpm</span></span>
          </div>
          <div className="lp-tele-item">
            <span className="lp-tele-k">Apex</span>
            <span className="lp-tele-v"><span ref={apexRef}>—</span><span className="u">m</span></span>
          </div>
          <div className="lp-tele-item">
            <span className="lp-tele-k">Line call</span>
            <span className="lp-tele-v" ref={callRef}>· · ·</span>
          </div>
        </div>
      </div>
    </>
  );
}
