"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getShare, type SharePayload } from "@/lib/history";

export default function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<SharePayload | null | "missing">(null);

  useEffect(() => {
    getShare(id).then((d) => setData(d ?? "missing"));
  }, [id]);

  if (data === null) return <div style={{ padding: 40 }}>Loading…</div>;
  if (data === "missing") {
    return (
      <div style={{ padding: 40, maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "var(--font-display), serif" }}>Summary not found</h1>
        <p style={{ color: "var(--ink-soft)" }}>This link may have expired. <Link href="/" style={{ color: "var(--court)" }}>Go to TopSpin</Link>.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Link href="/" className="brand-link"><span className="brand-dot" /><span className="brand-name">TopSpin</span></Link>
        <button className="btn btn-ghost no-print" onClick={() => window.print()}>Print / save PDF</button>
      </div>

      <div className="card">
        <div className="card-title">Stroke summary for a coach</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 26, fontWeight: 800, textTransform: "capitalize" }}>{data.stroke}</span>
          <span className="pill accent">form {data.formScore}/100</span>
          {data.serveSpeedKmh && <span className="pill">~{data.serveSpeedKmh} km/h serve</span>}
        </div>
        <p style={{ color: "var(--ink-soft)", fontSize: 13 }}>Auto-generated from a single clip. A rough read to look at before the lesson, not a substitute for a coach&apos;s eye.</p>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">What the analysis flagged</div>
        {(!data.flaws || data.flaws.length === 0)
          ? <p style={{ color: "var(--ink-soft)" }}>Nothing major at contact.</p>
          : data.flaws.map((f) => (
            <div key={f.id} style={{ marginBottom: 12 }}>
              <strong>{f.label}</strong>
              <div style={{ color: "var(--ink-soft)", fontSize: 14 }}>{f.coaching_cue}</div>
            </div>
          ))}
      </div>

      {data.jointFeedback?.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">Readings at contact</div>
          <table className="data"><tbody>
            {data.jointFeedback.map((j) => (
              <tr key={j.joint}><td>{j.joint}</td><td className="mono">{j.reading}</td>
                <td><span className={`pill ${j.status === "good" ? "good" : j.status === "minor" ? "warn" : "off"}`}>{j.status}</span></td></tr>
            ))}
          </tbody></table>
        </div>
      )}

      {data.workout && data.workout.drills.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">Suggested homework · {data.workout.total_minutes} min</div>
          {data.workout.drills.map((d) => (
            <div key={d.id} style={{ marginBottom: 10 }}>
              <strong>{d.name}</strong> <span className="tag">{d.sets} × {d.reps}</span>
              <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>{d.focus}</div>
            </div>
          ))}
        </div>
      )}

      <p style={{ color: "var(--ink-soft)", fontSize: 12, marginTop: 20, textAlign: "center" }}>
        Generated {new Date(data.createdAt).toLocaleDateString()} · topspin
      </p>
      <style>{`@media print { .no-print { display: none } .card { box-shadow: none } }`}</style>
    </div>
  );
}
