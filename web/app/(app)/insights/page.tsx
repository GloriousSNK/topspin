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

  const maxDaily = stats ? Math.max(1, ...stats.daily.map((d) => d.views)) : 1;

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
          <div className="grid grid-3" style={{ marginBottom: 18 }}>
            <Metric value={stats.total_views} label="Total views" />
            <Metric value={stats.unique_visitors} label="Unique visitors" accent />
            <Metric value={stats.views_today} label="Views · last 24h" />
            <Metric value={stats.active_today} label="Visitors · last 24h" />
            <Metric value={stats.per_page.length} label="Pages seen" />
            <Metric
              value={stats.total_views && stats.unique_visitors
                ? (stats.total_views / stats.unique_visitors).toFixed(1)
                : "0"}
              label="Views per visitor"
            />
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr", alignItems: "start" }} >
            <div className="card">
              <div className="card-title">Views · last 7 days</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 180, paddingTop: 10 }}>
                {stats.daily.map((d) => (
                  <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <span className="mono" style={{ fontSize: 11, color: "var(--ink-soft)" }}>{d.views}</span>
                    <div
                      title={`${d.date}: ${d.views}`}
                      style={{
                        width: "100%",
                        height: `${(d.views / maxDaily) * 130}px`,
                        minHeight: 4,
                        background: "var(--accent)",
                        border: "2px solid var(--ink)",
                        borderRadius: "6px 6px 0 0",
                      }}
                    />
                    <span style={{ fontSize: 10, color: "var(--ink-soft)" }}>
                      {new Date(d.date).toLocaleDateString(undefined, { weekday: "short" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-title">Top pages</div>
              {stats.per_page.length === 0 && <Empty />}
              {stats.per_page.map((p) => {
                const max = Math.max(1, ...stats.per_page.map((x) => x.views));
                return (
                  <div key={p.path} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span className="mono" style={{ fontWeight: 600 }}>{p.path}</span>
                      <span style={{ color: "var(--ink-soft)" }}>{p.views}</span>
                    </div>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${(p.views / max) * 100}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <div className="card-title">Recent activity</div>
            {stats.recent.length === 0 && <Empty />}
            <table className="data">
              <tbody>
                {stats.recent.map((r, i) => (
                  <tr key={i}>
                    <td className="mono" style={{ fontWeight: 600 }}>{r.path}</td>
                    <td style={{ color: "var(--ink-soft)", textAlign: "right" }}>{timeAgo(r.ts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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

function Empty() {
  return <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>No data yet — browse a few pages and it&apos;ll show up here.</p>;
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
