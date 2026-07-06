"use client";

import { useEffect, useRef } from "react";

/**
 * Court lines that become a body.
 * Fourteen line segments start as the geometry of a tennis court and
 * interpolate — driven by scroll position — into a pose skeleton, the 33-
 * landmark model that reads your stroke. Scroll down: the court learns
 * to see you. Scroll up: the body dissolves back into chalk.
 */

type Seg = [number, number, number, number];

const VW = 640, VH = 430;

// --- shape A: a tennis court (top view, centred) ---
const court: Seg[] = [
  [80, 65, 560, 65],     // far baseline
  [80, 365, 560, 365],   // near baseline
  [80, 65, 80, 365],     // left doubles
  [560, 65, 560, 365],   // right doubles
  [122, 65, 122, 365],   // left singles
  [518, 65, 518, 365],   // right singles
  [122, 145, 518, 145],  // far service line
  [122, 285, 518, 285],  // near service line
  [320, 145, 320, 285],  // centre service line
  [80, 215, 560, 215],   // net
  [320, 65, 320, 78],    // far centre mark
  [320, 352, 320, 365],  // near centre mark
  [80, 215, 80, 196],    // net post L
  [560, 215, 560, 196],  // net post R
];

// --- shape B: a pose skeleton mid-forehand ---
const K: Record<string, [number, number]> = {
  head: [316, 74], neck: [316, 118],
  ls: [274, 132], rs: [358, 128],
  le: [236, 196], re: [428, 118],
  lw: [252, 258], rw: [498, 96],
  hipL: [288, 250], hipR: [340, 248],
  lk: [268, 322], rk: [362, 318],
  la: [258, 396], ra: [388, 390],
};
const skel: Seg[] = [
  [K.ls[0], K.ls[1], K.rs[0], K.rs[1]],
  [K.neck[0], K.neck[1], K.head[0], K.head[1]],
  [K.ls[0], K.ls[1], K.le[0], K.le[1]],
  [K.le[0], K.le[1], K.lw[0], K.lw[1]],
  [K.rs[0], K.rs[1], K.re[0], K.re[1]],
  [K.re[0], K.re[1], K.rw[0], K.rw[1]],
  [K.ls[0], K.ls[1], K.hipL[0], K.hipL[1]],
  [K.rs[0], K.rs[1], K.hipR[0], K.hipR[1]],
  [K.hipL[0], K.hipL[1], K.hipR[0], K.hipR[1]],
  [K.hipL[0], K.hipL[1], K.lk[0], K.lk[1]],
  [K.lk[0], K.lk[1], K.la[0], K.la[1]],
  [K.hipR[0], K.hipR[1], K.rk[0], K.rk[1]],
  [K.rk[0], K.rk[1], K.ra[0], K.ra[1]],
  [K.neck[0], K.neck[1], K.ls[0], K.ls[1]],
];
const joints = Object.values(K);

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function CourtMorph() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);
  const labelRef = useRef<SVGTextElement>(null);
  const pRef = useRef(-1);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let raf = 0;

    function apply(p: number) {
      const e = ease(p);
      for (let i = 0; i < court.length; i++) {
        const el = lineRefs.current[i];
        if (!el) continue;
        const a = court[i], b = skel[i];
        el.setAttribute("x1", String(a[0] + (b[0] - a[0]) * e));
        el.setAttribute("y1", String(a[1] + (b[1] - a[1]) * e));
        el.setAttribute("x2", String(a[2] + (b[2] - a[2]) * e));
        el.setAttribute("y2", String(a[3] + (b[3] - a[3]) * e));
        // chalk → grass green as it becomes a body
        const warm = Math.max(0, (e - 0.55) / 0.45);
        el.setAttribute("stroke", warm > 0
          ? `rgba(${29 - warm * 6}, ${34 + warm * 69}, ${27 + warm * 31}, ${0.42 + warm * 0.48})`
          : "rgba(29,34,27,0.42)");
      }
      const dotIn = Math.max(0, (e - 0.72) / 0.28);
      for (const d of dotRefs.current) {
        if (!d) continue;
        d.setAttribute("opacity", String(dotIn));
        d.setAttribute("r", String(3.2 * dotIn + 0.001));
      }
      if (labelRef.current) labelRef.current.setAttribute("opacity", String(dotIn));
    }

    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const node = wrapRef.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const vh = window.innerHeight;
        // 0 when the panel enters at 88% of the viewport → 1 by 30%
        const p = Math.min(1, Math.max(0, (vh * 0.88 - rect.top) / (vh * 0.58)));
        if (Math.abs(p - pRef.current) < 0.002) return;
        pRef.current = p;
        apply(p);
      });
    }

    apply(0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="lp-panel" ref={wrapRef}>
      <div className="lp-panel-head">
        <span>Pose extraction</span>
        <span className="val">33 LANDMARKS</span>
      </div>
      <div className="lp-panel-body">
        <svg viewBox={`0 0 ${VW} ${VH}`} aria-label="Court lines morphing into a pose skeleton as you scroll">
          {court.map((s, i) => (
            <line
              key={i}
              ref={(el) => { lineRefs.current[i] = el; }}
              x1={s[0]} y1={s[1]} x2={s[2]} y2={s[3]}
              stroke="rgba(29,34,27,0.42)" strokeWidth={1.6} strokeLinecap="round"
            />
          ))}
          {joints.map(([x, y], i) => (
            <circle
              key={i}
              ref={(el) => { dotRefs.current[i] = el; }}
              cx={x} cy={y} r={0} opacity={0} fill="var(--green)"
            />
          ))}
          <text
            ref={labelRef}
            x={K.rw[0] + 12} y={K.rw[1] - 10} opacity={0}
            fontSize={11} fill="var(--green)"
            fontFamily="var(--font-geist-mono), monospace" letterSpacing="0.12em"
          >
            CONTACT
          </text>
        </svg>
      </div>
      <div className="lp-panel-foot">
        <span>SCROLL — THE COURT LEARNS TO SEE YOU</span>
        <span>MEDIAPIPE · ON-DEVICE</span>
      </div>
    </div>
  );
}
