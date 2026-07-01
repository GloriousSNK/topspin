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
      <div className="h1">Traffic insights</div>
      <p className="lead">
        Anonymous, self-hosted analytics — no cookies, no third parties, nothing leaves your
        machine. Updates live as people move through the site.
      </p>

      {loading && !stats && !err && (
        <div className="card" style={{ marginBottom: 18 }}>
          <strong style={{ color: "var(--court)" }}>● Waking up the analytics service…</strong>{" "}
          <span style={{ color: "var(--ink-soft)" }}>
            A free-tier backend can take ~30s to spin up after being idle. Hang tight.
          </span>
        </div>
      )}

      {err && !stats && (
        <div className="card" style={{ borderColor: "var(--danger)", marginBottom: 18 }}>
          <strong style={{ color: "var(--danger)" }}>Can&apos;t reach the analytics service.</strong>{" "}
          <span style={{ color: "var(--ink-soft)" }}>
            It may still be waking up (free tier) — it&apos;ll refresh automatically. Endpoint: {api.base}
          </span>
        </div>
      )}

      {err && stats && (
        <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 12 }}>
          ⟳ Showing last known data — reconnecting…
        </div>
      )}

      {stats && (
        <>
          {/* headline: real impact */}
          <div className="card" style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <span style={{ fontSize: 44 }}>🎾</span>
            <div className="stat">
              <span className="stat-value" style={{ fontSize: 44, color: "var(--court)" }}>{stats.people_helped}</span>
              <span className="stat-label">People helped · strokes sent for AI analysis</span>
            </div>
          </div>

          <div className="grid grid-3" style={{ marginBottom: 18 }}>
            <Metric value={stats.unique_visitors} label="Lifetime visitors" />
            <Metric value={stats.total_views} label="Total page views" />
            <Metric value={stats.active_today} label="Visitors · last 24h" />
          </div>

        </>
      )}
    </div>
  );
}

function Metric({ value, label, accent }: { value: number | string; label: string; accent?: boolean }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="stat">
        <span className="stat-value" style={{ color: accent ? "var(--court)" : "var(--ink)" }}>{value}</span>
        <span className="stat-label">{label}</span>
      </div>
    </div>
  );
}

