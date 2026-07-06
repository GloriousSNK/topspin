"use client";

import { Reveal, Counter } from "./Motion";
import { useTrafficStats } from "@/lib/useTrafficStats";

/* The count-up band. Three numbers are constants about the engine; the last
   one is live usage from the analytics service, so it counts up to the real
   number of strokes people have run through TopSpin. */

const FALLBACK_CLIPS = 88;

export default function LiveNumbers() {
  const stats = useTrafficStats();
  const clips = stats?.videos_analyzed ?? FALLBACK_CLIPS;

  return (
    <section aria-label="By the numbers">
      <div className="container">
        <div className="lp-numbers">
          <Reveal className="lp-number" delay={0}>
            <span className="v"><Counter to={320} /></span>
            <span className="k">Flights per prediction</span>
          </Reveal>
          <Reveal className="lp-number" delay={90}>
            <span className="v"><Counter to={33} /></span>
            <span className="k">Pose landmarks tracked</span>
          </Reveal>
          <Reveal className="lp-number" delay={180}>
            <span className="v"><Counter to={0.7} decimals={1} suffix="s" /></span>
            <span className="k">Full physics prediction</span>
          </Reveal>
          <Reveal className="lp-number" delay={270}>
            <span className="v"><Counter to={clips} /></span>
            <span className="k">Strokes analysed so far</span>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
