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
            <Metric value={stats.orgs_reached} label="Schools, clubs & teams reached" />
            <Metric value={stats.countries_reached} label="Countries reached" accent />
          </div>
        </>
      )}
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
