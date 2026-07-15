"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getParentReport, type ParentReportPayload } from "@/lib/coach";

export default function ParentReportPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<ParentReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    getParentReport(id).then((value) => { if (alive) setReport(value); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);
  const scored = useMemo(() => report?.summaries.filter((s) => s.form_score !== null) ?? [], [report]);
  const average = scored.length ? Math.round(scored.reduce((n, s) => n + (s.form_score ?? 0), 0) / scored.length) : null;

  if (loading) return <main className="container" style={{ paddingTop: 60 }}><h1 className="h1">Loading report...</h1></main>;
  if (!report) return <main className="container" style={{ paddingTop: 60 }}><h1 className="h1">Report unavailable</h1><p className="lead">This link may have expired or been removed.</p><Link className="btn" href="/">TopSpin home</Link></main>;
  return <main className="container report-shell">
    <div className="report-mark">TOPSPIN LABS / PLAYER REPORT</div>
    <h1 className="h1">{report.playerName}</h1>
    <p className="lead">Recent practice with {report.coachName}. Prepared {new Date(report.createdAt).toLocaleDateString()}.</p>
    <div className="grid grid-3" style={{ marginBottom: 18 }}>
      <Stat value={report.summaries.length} label="Sessions" />
      <Stat value={average ?? "--"} label="Average score" />
      <Stat value={report.summaries.reduce((n, s) => n + s.drills_completed, 0)} label="Practice completed" />
    </div>
    <div className="card">
      <div className="card-title">Recent work</div>
      <div className="table-wrap"><table className="data"><thead><tr><th>Date</th><th>Stroke</th><th>Score</th><th>Practice</th></tr></thead><tbody>
        {report.summaries.map((s) => <tr key={s.id}><td>{new Date(s.created_at).toLocaleDateString()}</td><td>{s.stroke ?? "Session"}</td><td>{s.form_score ?? "--"}</td><td>{s.drills_completed}</td></tr>)}
      </tbody></table></div>
      {report.note && <p style={{ marginTop: 16 }}>{report.note}</p>}
    </div>
    <p style={{ color: "var(--ink-soft)", fontSize: 12, marginTop: 16 }}>Private-by-link report. It expires automatically after 30 days.</p>
  </main>;
}

function Stat({ value, label }: { value: number | string; label: string }) { return <div className="stat"><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>; }
