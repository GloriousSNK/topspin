"use client";

import { useTrafficStats } from "@/lib/useTrafficStats";
import { BackendWakeupPanel } from "@/components/BackendStatus";

export default function Insights() {
  // Same shared source the landing page reads, so the numbers match exactly.
  const stats = useTrafficStats();

  return (
    <div>
      <span className="eyebrow">Telemetry</span>
      <h1 className="h1">Traffic insights</h1>
      <p className="lead">
        Anonymous, self-hosted analytics. No cookies, no third parties, nothing leaves your
        machine. Updates live as people move through the site.
      </p>

      {!stats && <BackendWakeupPanel title="Loading live TopSpin numbers" />}

      {stats && (
        <>
          <div className="grid grid-4">
            <Metric value={stats.videos_analyzed} label="Videos analyzed" accent />
            <Metric value={stats.practice_sessions} label="Practice sessions completed" />
            <Metric value={stats.simulations} label="Simulations generated" />
            <Metric value={stats.frames_processed} label="Frames processed" />
            <Metric value={footage(stats.footage_seconds)} label="Footage analyzed" />
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

// A plain-English account of exactly how these numbers are measured. Being open
// about the method — and its limits — is what makes the figures trustworthy to a
// skeptical reader, more than any single number could.
function Methodology() {
  const items: [string, string][] = [
    [
      "Anonymous and cookie-free",
      "No cookies, no third-party trackers, no ad pixels. Your IP address is hashed the moment a request arrives and never stored — we keep only the irreversible hash.",
    ],
    [
      "How unique people are counted",
      "A distinct visitor is a salted, one-way hash of IP + browser, computed on our server — not an id the browser sends. That means the count can't be inflated by scripting fake ids; doing so would need genuinely different networks. People sharing one network/browser collapse into one, so if anything this under-counts.",
    ],
    [
      "Bots are excluded",
      "Crawlers, scrapers, and link-preview fetchers are filtered out before anything is recorded, so search-engine and monitoring traffic never pads the numbers.",
    ],
    [
      "What each figure means",
      "“Athletes served” = email-verified accounts plus distinct origins that actually ran a tool. “Simulations”, “videos” and “frames” count real work the engine performed. Countries come from a coarse network-level region, never a precise location.",
    ],
    [
      "The honest limit",
      "No public, no-login metric is perfectly tamper-proof. The most solid number here is email-verified accounts, since faking those at scale needs real inboxes.",
    ],
  ];
  return (
    <div className="card" style={{ marginTop: 22 }}>
      <div className="card-title">How these numbers are measured</div>
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
