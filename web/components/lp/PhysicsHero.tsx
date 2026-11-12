"use client";

import { useEffect, useRef } from "react";

/**
 * The hero is not a video and not a tween — it's the product.
 * A perspective wireframe court with tennis balls integrated in real time
 * under gravity + quadratic drag + Magnus lift (the same model the backend
 * uses), a fading flight trail, a landing dispersion cloud, ripples on
 * impact, and a telemetry HUD reading live values out of the simulation.
 * Pointer moves the camera a few degrees. Pauses offscreen and off-tab.
 *
 * Frame budget notes (this runs every frame behind the hero CTAs):
 * - zero allocations per frame: physics, projection and trails use scratch
 *   numbers and fixed ring buffers;
 * - colour alpha goes through globalAlpha against constant colours, so no
 *   per-frame rgba() strings are built and parsed;
 * - the ball glow is a pre-rendered sprite instead of a new radial gradient
 *   per ball per frame;
 * - the backing store is capped (≤2x, and ~2.6M device px for big screens);
 * - the pointer handler only stores coordinates; the camera target is
 *   computed in the frame from a rect cached by ResizeObserver /
 *   IntersectionObserver, so there are no layout reads during input;
 * - the loop starts when the browser is idle after hydration, so the hero
 *   text and buttons are interactive first. The court is painted immediately.
 * - telemetry is written straight to text nodes on launch/landing only.
 */

// ---- physics constants (mirrors ml-service/app/core/ball_physics.py) ----
const G = 9.81, RHO = 1.21, CD = 0.55, R = 0.0335, M = 0.057;
const AREA = Math.PI * R * R;
const COURT_L = 23.77, COURT_W_HALF = 4.115, DOUBLES_HALF = 5.485;
const NET_X = 11.885, NET_H = 1.0;
const SERVICE_NEAR = 5.485, SERVICE_FAR = 18.285;

const TRAIL_MAX = 110;
const DT = 1 / 200;
const BUDGET_PX = 2.6e6;          // max device pixels for the hero backing store
const GLOW_REF = 12;              // sprite reference ball radius (CSS px)

type V3 = [number, number, number];

/** Writes the acceleration for velocity v, spin w into out (no allocation). */
function accel(v: V3, w: V3, out: V3): void {
  const speed = Math.hypot(v[0], v[1], v[2]);
  out[0] = 0; out[1] = 0; out[2] = -G;
  if (speed < 1e-9) return;
  const dragK = (0.5 * RHO * CD * AREA * speed) / M;
  out[0] -= dragK * v[0]; out[1] -= dragK * v[1]; out[2] -= dragK * v[2];
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
    out[0] += mk * cx; out[1] += mk * cy; out[2] += mk * cz;
  }
}

interface Ball {
  p: V3; v: V3; w: V3;
  trail: Float64Array;     // ring buffer of TRAIL_MAX xyz points
  tStart: number; tLen: number;
  live: boolean;
  wait: number;            // frames to wait before relaunch
}
interface Mark { x: number; y: number; in: boolean; age: number; }
interface Ripple { x: number; y: number; t: number; in: boolean; }

const newBall = (wait: number): Ball => ({
  p: [0, 0, 1], v: [0, 0, 0], w: [0, 0, 0],
  trail: new Float64Array(TRAIL_MAX * 3), tStart: 0, tLen: 0,
  live: false, wait,
});

function pushTrail(b: Ball) {
  let i: number;
  if (b.tLen < TRAIL_MAX) { i = (b.tStart + b.tLen) % TRAIL_MAX; b.tLen++; }
  else { i = b.tStart; b.tStart = (b.tStart + 1) % TRAIL_MAX; }
  b.trail[i * 3] = b.p[0]; b.trail[i * 3 + 1] = b.p[1]; b.trail[i * 3 + 2] = b.p[2];
}

/** The ball's glow, drawn once at a reference size and scaled per frame. */
function makeGlow(dpr: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  const r = GLOW_REF * dpr, s = Math.ceil(r * 4.8);
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  const cx = s / 2;
  const grad = g.createRadialGradient(cx - r * 0.3, cx - r * 0.3, 0, cx, cx, r * 2.4);
  grad.addColorStop(0, "rgba(222, 244, 80, 1)");
  grad.addColorStop(0.4, "rgba(174, 199, 32, 0.95)");
  grad.addColorStop(1, "rgba(174, 199, 32, 0)");
  g.fillStyle = grad;
  g.beginPath(); g.arc(cx, cx, r * 2.4, 0, Math.PI * 2); g.fill();
  return c;
}

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
    let raf = 0, alive = true, started = false, visible = true;
    let glow: HTMLCanvasElement | null = null, glowDpr = 0;

    // ---- camera (pointer-steered, critically damped) ----
    const cam = { y: 0, z: 2.6, ty: 0, tz: 2.6 };
    const CAMX = -7.5;
    let FL = 0; // focal length, W * 0.78

    // projection writes into these three scratch slots (no tuple allocation)
    let PX = 0, PY = 0, PD = 0;
    function project(x: number, y: number, z: number) {
      const dx = x - CAMX, dy = y - cam.y, dz = z - cam.z;
      const s = FL / dx;
      PX = W / 2 + dy * s; PY = H * 0.46 - dz * s; PD = dx;
    }

    // ---- court wireframe segments, flat [x1,y1,z1,x2,y2,z2,...] ----
    const segList: number[] = [];
    const seg = (a: V3, b: V3) => segList.push(a[0], a[1], a[2], b[0], b[1], b[2]);
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
    const segs = Float64Array.from(segList);

    // ---- state ----
    const balls: Ball[] = [newBall(10), newBall(140)];
    const marks: Mark[] = [];
    const ripples: Ripple[] = [];
    let shotNo = 0;
    let apex = 0;
    // scratch vectors for the integrator
    const a1: V3 = [0, 0, 0], a2: V3 = [0, 0, 0], vm: V3 = [0, 0, 0];
    // projected trail points, reused by every ball
    const trailXY = new Float32Array(TRAIL_MAX * 2);

    function launch(b: Ball) {
      shotNo += 1;
      const y0 = (Math.random() - 0.5) * 5;
      const speed = 23 + Math.random() * 11;                  // m/s
      const elev = (5 + Math.random() * 9) * (Math.PI / 180);
      const azim = Math.atan2((Math.random() - 0.5) * 6 - y0 * 0.6, 22);
      b.p[0] = 0.4; b.p[1] = y0; b.p[2] = 0.9 + Math.random() * 0.5;
      b.v[0] = speed * Math.cos(elev) * Math.cos(azim);
      b.v[1] = speed * Math.cos(elev) * Math.sin(azim);
      b.v[2] = speed * Math.sin(elev);
      const topspin = 120 + Math.random() * 200;              // rad/s
      const side = (Math.random() - 0.5) * 60;
      b.w[0] = 0; b.w[1] = topspin; b.w[2] = side;
      b.tStart = 0; b.tLen = 0;
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

    function step(b: Ball) {
      const p = b.p, v = b.v;
      // RK2 midpoint × 3 substeps per frame ≈ real-time flight
      for (let i = 0; i < 3; i++) {
        accel(v, b.w, a1);
        vm[0] = v[0] + a1[0] * DT * 0.5; vm[1] = v[1] + a1[1] * DT * 0.5; vm[2] = v[2] + a1[2] * DT * 0.5;
        accel(vm, b.w, a2);
        const nz = p[2] + vm[2] * DT;
        if (nz <= 0 && p[2] > 0) {
          const f = p[2] / (p[2] - nz);
          p[0] = p[0] + vm[0] * DT * f; p[1] = p[1] + vm[1] * DT * f; p[2] = 0;
          land(b);
          return;
        }
        p[0] = p[0] + vm[0] * DT; p[1] = p[1] + vm[1] * DT; p[2] = nz;
        v[0] = v[0] + a2[0] * DT; v[1] = v[1] + a2[1] * DT; v[2] = v[2] + a2[2] * DT;
      }
      if (p[2] > apex) apex = p[2];
      pushTrail(b);
      if (p[0] > 40 || Math.abs(p[1]) > 20) { b.live = false; b.wait = 30; } // safety
    }

    // ---- drawing ----
    function drawCourt() {
      const c = ctx!;
      // depth-fogged chalk lines: nearer lines brighter
      c.strokeStyle = "rgb(29, 34, 27)";
      c.lineWidth = 1.3;
      for (let i = 0; i < segs.length; i += 6) {
        project(segs[i], segs[i + 1], segs[i + 2]);
        const x1 = PX, y1 = PY, d1 = PD;
        project(segs[i + 3], segs[i + 4], segs[i + 5]);
        c.globalAlpha = Math.max(0.1, Math.min(0.45, 9.5 / ((d1 + PD) / 2)));
        c.beginPath(); c.moveTo(x1, y1); c.lineTo(PX, PY); c.stroke();
      }
      // net: top cord, band posts, mesh verticals
      project(NET_X, -DOUBLES_HALF - 0.3, NET_H);
      const nx1 = PX, ny1 = PY;
      project(NET_X, DOUBLES_HALF + 0.3, NET_H);
      c.globalAlpha = 0.5; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(nx1, ny1); c.lineTo(PX, PY); c.stroke();
      // the mesh verticals never overlap each other: one path, one stroke
      c.globalAlpha = 0.16; c.lineWidth = 1;
      c.beginPath();
      for (let y = -5; y <= 5; y += 1.25) {
        project(NET_X, y, NET_H);
        c.moveTo(PX, PY);
        project(NET_X, y, 0);
        c.lineTo(PX, PY);
      }
      c.stroke();
      c.globalAlpha = 1;
    }

    function drawMarks(ticks: number) {
      const c = ctx!;
      let fill = "";
      for (let i = 0; i < marks.length; i++) {
        const m = marks[i];
        m.age += ticks;
        const fade = Math.max(0, 1 - m.age / 1400);
        if (fade <= 0) continue;
        project(m.x, m.y, 0);
        const r = Math.max(1.4, 26 / PD);
        const f = m.in ? "rgb(23, 127, 63)" : "rgb(194, 62, 31)";
        if (f !== fill) { c.fillStyle = f; fill = f; }
        c.globalAlpha = 0.5 * fade;
        c.beginPath(); c.ellipse(PX, PY, r, r * 0.45, 0, 0, Math.PI * 2); c.fill();
      }
      c.lineWidth = 1.4;
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        if (ticks) {
          rp.t += 0.028 * ticks;
          if (rp.t >= 1) { ripples.splice(i, 1); continue; }
        }
        project(rp.x, rp.y, 0);
        const rr = (rp.t * 130) / (PD * 0.55);
        c.strokeStyle = rp.in ? "rgb(23, 127, 63)" : "rgb(194, 62, 31)";
        c.globalAlpha = (rp.in ? 0.5 : 0.45) * (1 - rp.t);
        c.beginPath(); c.ellipse(PX, PY, rr, rr * 0.45, 0, 0, Math.PI * 2); c.stroke();
      }
      c.globalAlpha = 1;
    }

    function drawBall(b: Ball) {
      const c = ctx!;
      // trail — glow pass then core pass, from one projection of the points
      const n = b.tLen;
      if (n > 2) {
        for (let i = 0; i < n; i++) {
          const k = ((b.tStart + i) % TRAIL_MAX) * 3;
          project(b.trail[k], b.trail[k + 1], b.trail[k + 2]);
          trailXY[i * 2] = PX; trailXY[i * 2 + 1] = PY;
        }
        c.strokeStyle = "rgb(133, 154, 22)";
        for (let pass = 0; pass < 2; pass++) {
          c.lineWidth = pass === 0 ? 5 : 1.6;
          c.globalAlpha = pass === 0 ? 0.05 : 0.5;
          c.beginPath();
          c.moveTo(trailXY[0], trailXY[1]);
          for (let i = 1; i < n; i++) c.lineTo(trailXY[i * 2], trailXY[i * 2 + 1]);
          c.stroke();
        }
        c.globalAlpha = 1;
      }
      if (!b.live) return;
      project(b.p[0], b.p[1], b.p[2]);
      const x = PX, y = PY;
      const r = Math.max(2, 42 / PD);
      // ground shadow
      project(b.p[0], b.p[1], 0);
      c.fillStyle = "rgb(0, 0, 0)";
      c.globalAlpha = Math.max(0, Math.min(0.4, 3 / PD + b.p[2] * -0.02 + 0.25));
      c.beginPath(); c.ellipse(PX, PY, r * 0.9, r * 0.4, 0, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
      // ball with glow (pre-rendered radial gradient, scaled to this radius)
      if (glow) c.drawImage(glow, x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
    }

    // `ticks` = how many 60 Hz simulation steps to advance before drawing (0 = redraw only).
    function paint(ticks: number) {
      ctx!.clearRect(0, 0, W, H);
      drawCourt();
      drawMarks(ticks);
      for (const b of balls) {
        for (let t = 0; t < ticks; t++) {
          if (b.live) step(b);
          else if (--b.wait <= 0) launch(b);
        }
        drawBall(b);
      }
    }

    // ---- pointer: the handler stores numbers; the frame does the maths ----
    // hero box in page coordinates (unaffected by scrolling)
    const box = { top: 0, left: 0, w: 1, h: 1 };
    let ptrX = 0, ptrY = 0, ptrDirty = false;
    function setBox(r: DOMRectReadOnly) {
      box.left = r.left + window.scrollX; box.top = r.top + window.scrollY;
      box.w = r.width || 1; box.h = r.height || 1;
    }
    function applyPointer() {
      if (!ptrDirty) return;
      ptrDirty = false;
      if (ptrY < box.top || ptrY > box.top + box.h) { cam.ty = 0; cam.tz = 2.6; return; }
      const px = (ptrX - box.left) / box.w - 0.5;
      const py = (ptrY - box.top) / box.h - 0.5;
      cam.ty = px * 2.4;
      cam.tz = 2.6 - py * 0.9;
    }

    // The sim is tuned for one step per 60 Hz frame. Drive it from a fixed 60 Hz
    // clock so 120/144 Hz screens don't play it at 2x speed; frames with no due
    // step skip the redraw since nothing moved. The 1 ms slack absorbs frame
    // jitter on 60 Hz displays so they still get exactly one step per frame.
    const TICK = 1000 / 60;
    let last = 0, acc = 0;
    function frame(now: number) {
      raf = 0;
      if (!alive || !visible || document.hidden) { last = 0; return; }
      if (!last) last = now - TICK;
      acc = Math.min(acc + (now - last), TICK * 4); // after a stall, catch up at most 4 steps
      last = now;
      let ticks = 0;
      while (acc >= TICK - 1) { acc -= TICK; ticks++; }
      applyPointer();
      for (let t = 0; t < ticks; t++) {
        cam.y += (cam.ty - cam.y) * 0.045;
        cam.z += (cam.tz - cam.z) * 0.045;
      }
      if (ticks) paint(ticks);
      raf = requestAnimationFrame(frame);
    }
    function kick() {
      if (!raf && started && alive && visible && !document.hidden && !reduce) raf = requestAnimationFrame(frame);
    }

    // ---- static fallback: one precomputed trajectory, no animation ----
    function drawStatic() {
      ctx!.clearRect(0, 0, W, H);
      drawCourt();
      const b = newBall(0);
      b.p[0] = 0.4; b.p[1] = -1.2; b.p[2] = 1.1;
      b.w[0] = 0; b.w[1] = 190; b.w[2] = 20;
      b.live = true;
      const sp = 28, el = 9 * (Math.PI / 180);
      b.v[0] = sp * Math.cos(el); b.v[1] = 1.2; b.v[2] = sp * Math.sin(el);
      for (let i = 0; i < 3000 && b.live; i++) step(b);
      marks.length = 0; ripples.length = 0; // don't pile up marks on every resize
      for (let i = 0; i < 14; i++)
        marks.push({ x: 17 + (Math.random() - 0.5) * 3.4, y: -0.4 + (Math.random() - 0.5) * 2.6, in: Math.random() > 0.18, age: 0 });
      drawMarks(1);
      drawBall(b);
      if (vRef.current) vRef.current.textContent = (sp * 3.6).toFixed(0);
      if (spinRef.current) spinRef.current.textContent = "1814";
      if (apexRef.current) apexRef.current.textContent = "2.6";
      if (shotRef.current) shotRef.current.textContent = "001";
      if (callRef.current) { callRef.current.textContent = "IN"; callRef.current.className = "lp-tele-v in"; }
    }

    // ---- sizing: ResizeObserver runs after layout, so measuring here is free ----
    function resize() {
      const rect = wrap!.getBoundingClientRect();
      setBox(rect);
      if (rect.width < 1 || rect.height < 1) return;
      const native = window.devicePixelRatio || 1;
      const hi = Math.min(2, native), lo = Math.min(1.5, native);
      // full-bleed canvas: keep retina sharpness on normal screens, but cap the
      // pixel count on very large ones (fill cost scales with device pixels)
      dpr = Math.max(lo, Math.min(hi, Math.sqrt(BUDGET_PX / (rect.width * rect.height))));
      W = rect.width; H = rect.height;
      FL = W * 0.78;
      canvas!.width = Math.round(W * dpr);
      canvas!.height = Math.round(H * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (dpr !== glowDpr) { glow = makeGlow(dpr); glowDpr = dpr; }
      // resizing clears the buffer; repaint now so it never flashes empty
      if (reduce) drawStatic(); else paint(0);
    }
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    if (reduce) return () => { alive = false; ro.disconnect(); };

    // the canvas layer is pointer-events:none so the hero CTAs stay clickable;
    // steer the camera from window-level moves instead
    const onPointer = (e: PointerEvent) => { ptrX = e.pageX; ptrY = e.pageY; ptrDirty = true; };
    window.addEventListener("pointermove", onPointer, { passive: true });

    const io = new IntersectionObserver(([en]) => {
      setBox(en.boundingClientRect); // free, fresh rect from the observer
      visible = en.isIntersecting;
      if (visible) kick(); else { cancelAnimationFrame(raf); raf = 0; last = 0; }
    }, { threshold: 0.02 });
    io.observe(wrap);

    const onVis = () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; last = 0; }
      else kick();
    };
    document.addEventListener("visibilitychange", onVis);

    // start the sim once the main thread is free after hydration, so the CTAs
    // respond first; the court itself was already painted by the resize above
    const start = () => { started = true; kick(); };
    const hasRic = typeof window.requestIdleCallback === "function"; // Safari lacks it
    const idle = hasRic ? window.requestIdleCallback(start, { timeout: 400 }) : window.setTimeout(start, 80);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      if (hasRic) window.cancelIdleCallback(idle); else window.clearTimeout(idle);
      ro.disconnect(); io.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVis);
    };
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
            <span className="lp-tele-v"><span ref={vRef}>--</span><span className="u">km/h</span></span>
          </div>
          <div className="lp-tele-item">
            <span className="lp-tele-k">Topspin</span>
            <span className="lp-tele-v"><span ref={spinRef}>--</span><span className="u">rpm</span></span>
          </div>
          <div className="lp-tele-item">
            <span className="lp-tele-k">Apex</span>
            <span className="lp-tele-v"><span ref={apexRef}>--</span><span className="u">m</span></span>
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
