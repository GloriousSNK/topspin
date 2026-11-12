"use client";

import { useTrafficStats } from "@/lib/useTrafficStats";
import { BackendWakeupPanel } from "@/components/BackendStatus";

export default function Insights() {
  // Same shared source the landing page reads, so the numbers match exactly.
  const stats = useTrafficStats();

  return (
    <div>
      <span className="eyebrow">Insights</span>
      <h1 className="h1">Site activity</h1>
      <p className="lead">
        Running totals for everyone using TopSpin. We count these ourselves, without cookies or
        third-party trackers, and none of it is tied to a name or account.
      </p>

      {!stats && <BackendWakeupPanel title="Loading live TopSpin numbers" />}

      {stats && (
        <>
          <div className="grid grid-4">
            <Metric value={stats.videos_analyzed} label="Videos analysed" accent />
            <Metric value={stats.practice_sessions} label="Practice sessions built" />
            <Metric value={stats.simulations} label="Simulations generated" />
            <Metric value={stats.frames_processed} label="Frames processed" />
            <Metric value={footage(stats.footage_seconds)} label="Footage analysed" />
            <Metric value={stats.athletes_served} label="Athletes served" accent />
            <Metric value={stats.orgs_reached} label="Organizations reached" />
            <Metric value={stats.countries_reached} label="Countries reached" accent />
          </div>
        </>
      )}

      <Methodology />
    </div>
  );
}

function Methodology() {
  const items: [string, string][] = [
    [
      "What we collect",
      "When you open a page, your browser tells us which page it was and which site sent you, if any. Our server adds a country based on your network. We don't use cookies, ad pixels or outside analytics services.",
    ],
    [
      "How we count people",
      "To tell visitors apart, our server mixes your IP address and browser type with a secret key and keeps only the scrambled result. Your IP address is never saved. Two people on the same network and browser look like one person, so this count runs a little low.",
    ],
    [
      "Bots",
      "Search engine crawlers, link previews, uptime checkers and other automated traffic are dropped before anything is saved.",
    ],
    [
      "What the numbers mean",
      "Videos analysed counts clips run through Clip Analysis or Batch analysis, and footage and frames are the total running time and frame count of those clips. Practice sessions built counts sessions and drills the app put together for someone. Simulations counts every ball flight the physics engine worked out, including the extra flights behind each Ball Lab forecast. Athletes served is verified accounts plus visitors who used at least one tool. Organizations reached is the number of different websites that have sent people here. Countries come from your network, not your exact location.",
    ],
    [
      "Limits",
      "Anyone can view these totals without signing in, so a determined person could still push them up. The account count is the hardest to fake, because every account needs a confirmed email address.",
    ],
  ];
  return (
    <div className="card" style={{ marginTop: 22 }}>
      <div className="card-title">About these numbers</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 6 }}>
        {items.map(([t, d]) => (
          <div key={t}>
            <div style={{ fontWeight: 650, fontSize: 14 }}>{t}</div>
            <div style={{ color: "var(--ink-soft)", fontSize: 13.5, lineHeight: 1.55 }}>{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function footage(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function Metric({ value, label, accent }: { value: number | string; label: string; accent?: boolean }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="stat">
        <span className="stat-value" style={{ fontSize: 24, color: accent ? "var(--court)" : "var(--ink)" }}>
          {typeof value === "number" ? fmt(value) : value}
        </span>
        <span className="stat-label">{label}</span>
      </div>
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString();
}
