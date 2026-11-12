"use client";

import { memo } from "react";
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
  "50+ drill library",
];

// The stats hook hands back a fresh object on every 15s poll; the strip only
// depends on one number, so it is memoised on that and skips no-op renders.
export default function LiveMarquee() {
  const stats = useTrafficStats();
  // No made-up placeholder: the live item only appears once real numbers arrive.
  return <Strip clips={stats?.videos_analyzed ?? null} />;
}

const Strip = memo(function Strip({ clips }: { clips: number | null }) {
  const items = [...FIXED];
  if (clips !== null) items.splice(5, 0, `${clips.toLocaleString()} videos analysed`);

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
});
