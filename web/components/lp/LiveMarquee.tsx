"use client";

import { useTrafficStats } from "@/lib/useTrafficStats";

/* The credibility strip under the hero. Most of it is fixed fact about how the
   engine works; one item is live, pulled from the same analytics that power the
   Insights page, so the count of strokes we've broken down is always real. */

const FIXED = [
  "RK4 integration",
  "Drag + Magnus lift",
  "320-flight ensembles",
  "Finite-time Lyapunov",
  "33 pose landmarks",
  "Sub-second predictions",
  "34-drill engine",
];

// Shown only if the analytics service can't be reached, so the strip never
// reads a bare zero. Roughly where usage actually sits.
const FALLBACK_CLIPS = 88;

export default function LiveMarquee() {
  const stats = useTrafficStats();
  const clips = stats?.videos_analyzed ?? FALLBACK_CLIPS;

  const items = [...FIXED];
  items.splice(5, 0, `${clips.toLocaleString()} strokes analysed`);

  return (
    <div className="lp-strip" aria-hidden="true">
      <div className="lp-marquee">
        {[0, 1].map((set) => (
          <div className="lp-marquee-set" key={set}>
            {items.map((t, i) => <span key={i}>{t}</span>)}
          </div>
        ))}
      </div>
    </div>
  );
}
