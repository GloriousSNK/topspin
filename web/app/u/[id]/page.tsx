"use client";

import { use, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getPublicProfile, type Profile, type SessionRow } from "@/lib/history";

export default function PublicProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [state, setState] = useState<"loading" | "private" | "ok">("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<SessionRow[]>([]);

  useEffect(() => {
    getPublicProfile(id).then(({ profile, sessions }) => {
      if (!profile) { setState("private"); return; }
      setProfile(profile); setRows(sessions); setState("ok");
    });
  }, [id]);

  const stats = useMemo(() => {
    const scored = rows.filter((r) => typeof r.form_score === "number");
    const avg = scored.length ? Math.round(scored.reduce((s, r) => s + r.form_score, 0) / scored.length) : 0;
    const best = scored.reduce((m, r) => Math.max(m, r.form_score), 0);
    const serves = rows.filter((r) => r.serve_speed).map((r) => r.serve_speed as number);
    const topServe = serves.length ? Math.max(...serves) : 0;
    const flawCount = new Map<string, { label: string; n: number }>();
    for (const s of rows.slice(0, 30)) for (const f of s.flaws ?? []) {
      const e = flawCount.get(f.id) ?? { label: f.label, n: 0 }; e.n++; flawCount.set(f.id, e);
    }
    const flaws = [...flawCount.values()].sort((a, b) => b.n - a.n).slice(0, 5);
    return { count: rows.length, avg, best, topServe, scored: scored.reverse(), flaws };
  }, [rows]);

  if (state === "loading") return <div style={{ padding: 40, maxWidth: 760, margin: "0 auto" }}>Loading…</div>;
  if (state === "private") {
    return (
      <div style={{ padding: 40, maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "var(--font-display), serif" }}>Profile not available</h1>
        <p style={{ color: "var(--ink-soft)" }}>This profile is private or doesn&apos;t exist. <Link href="/" style={{ color: "var(--court)" }}>Go to TopSpin</Link>.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Link href="/" className="brand-link"><span className="brand-dot" /><span className="brand-name">TopSpin</span></Link>
        <Link href="/analyze" className="btn">Try it yourself</Link>
      </div>

      <span className="eyebrow">Player profile</span>
      <h1 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "clamp(30px,5vw,44px)", fontWeight: 600, marginBottom: 20 }}>
        {profile?.display_name || "A TopSpin player"}
      </h1>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <Stat v={stats.count} l="Analyses" />
        <Stat v={stats.avg} l="Average form" accent />
        <Stat v={stats.best} l="Best form" />
        <Stat v={stats.topServe ? `${stats.topServe}` : "—"} l="Top serve (km/h)" />
      </div>

      {stats.scored.length >= 2 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-title">Form score over time</div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: 140, fontSize: 10, color: "var(--ink-soft)" }}>
              <span>100</span><span>50</span><span>0</span>
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 5, height: 140, borderBottom: "2px solid var(--ink)" }}>
              {stats.scored.map((r) => (
                <div key={r.id} title={`${r.stroke} · ${r.form_score}/100`}
                  style={{ flex: 1, minWidth: 3, height: `${Math.max(3, r.form_score)}%`, background: "var(--accent)", border: "2px solid var(--ink)", borderRadius: "5px 5px 0 0" }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {stats.flaws.length > 0 && (
        <div className="card">
          <div className="card-title">Working on</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {stats.flaws.map((f) => <span key={f.label} className="pill">{f.label} ×{f.n}</span>)}
          </div>
        </div>
      )}

      <p style={{ color: "var(--ink-soft)", fontSize: 12, marginTop: 24, textAlign: "center" }}>
        Shared from TopSpin · form reads are a single-camera estimate
      </p>
    </div>
  );
}

function Stat({ v, l, accent }: { v: number | string; l: string; accent?: boolean }) {
  return <div className="card" style={{ padding: 16 }}><div className="stat">
    <span className="stat-value" style={{ fontSize: 24, color: accent ? "var(--court)" : "var(--ink)" }}>{v}</span>
    <span className="stat-label">{l}</span></div></div>;
}
