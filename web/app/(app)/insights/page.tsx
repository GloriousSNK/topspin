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
          {/* headline: analyses + workouts + simulations combined */}
          <div className="card" style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <span style={{ fontSize: 44 }}>🎾</span>
            <div className="stat">
              <span className="stat-value" style={{ fontSize: 44, color: "var(--court)" }}>{fmt(stats.people_helped)}</span>
              <span className="stat-label">AI analyses, workouts &amp; simulations run</span>
            </div>
          </div>

          <div className="grid grid-4">
            <Metric value={stats.total_views} label="Total page views" />
            <Metric value={stats.physics_steps} label="RK4 physics steps" accent />
            <Metric value={stats.trajectory_points} label="Trajectory points plotted" />
            <Metric value={stats.keypoints_tracked} label="Body keypoints tracked" />
          </div>
        </>
      )}
    </div>
  );
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

