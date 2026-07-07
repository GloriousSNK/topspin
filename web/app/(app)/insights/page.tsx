"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { TrafficStats } from "@/lib/types";

export default function Insights() {
  const [stats, setStats] = useState<TrafficStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const s = await api.stats();
        if (!alive) return;
        setStats(s);      // keep last good data on a later blip; only replace on success
        setErr(null);
      } catch (e) {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : "Failed to load stats");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 15000); // refresh while you watch
    return () => { alive = false; clearInterval(id); };
  }, []);

  return (
    <div>
      <span className="eyebrow">Telemetry</span>
      <h1 className="h1">Traffic insights</h1>
      <p className="lead">
        Anonymous, self-hosted analytics — no cookies, no third parties, nothing leaves your
        machine. Updates live as people move through the site.
      </p>

      {loading && !stats && !err && (
        <div className="card" style={{ marginBottom: 18 }}>
          <strong style={{ color: "var(--court)" }}>● Loading…</strong>
        </div>
      )}

      {err && !stats && (
        <div className="card" style={{ borderColor: "var(--danger)", marginBottom: 18 }}>
          <strong style={{ color: "var(--danger)" }}>Can&apos;t reach the analytics service.</strong>{" "}
          <span style={{ color: "var(--ink-soft)" }}>It&apos;ll refresh automatically.</span>
        </div>
      )}

      {err && stats && (
        <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 12 }}>
          ⟳ Showing last known data — reconnecting…
        </div>
      )}

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

