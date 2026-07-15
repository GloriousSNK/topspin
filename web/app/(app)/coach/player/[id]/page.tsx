"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  createParentReport, getCoachPlayerHistory, getSharedAnalyses, saveCoachNote,
  type CoachAnalysisShare, type CoachPlayerHistory,
} from "@/lib/coach";

export default function CoachPlayerPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [history, setHistory] = useState<CoachPlayerHistory | null>(null);
  const [shares, setShares] = useState<CoachAnalysisShare[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !id) return;
    let alive = true;
    Promise.all([getCoachPlayerHistory(user.id, id), getSharedAnalyses(user.id, id)]).then(([h, s]) => {
      if (!alive) return;
      setHistory(h); setShares(s); setReady(true);
    }).catch(() => { if (alive) { setError("Couldn't load this player."); setReady(true); } });
    return () => { alive = false; };
  }, [user, id]);

  const scores = useMemo(() => history?.summaries.filter((s) => s.form_score !== null) ?? [], [history]);
  const average = scores.length ? Math.round(scores.reduce((n, s) => n + (s.form_score ?? 0), 0) / scores.length) : null;

  async function note(shareId: string, value: string) {
    if (!user) return false;
    const ok = await saveCoachNote(user.id, shareId, value);
    if (ok) setShares((all) => all.map((s) => s.id === shareId ? { ...s, coach_note: value } : s));
    return ok;
  }

  async function report() {
    if (!user || !history) return;
    const reportId = await createParentReport(user.id, history.player_id, {
      playerName: history.display_name,
      coachName: user.email?.split("@")[0] ?? "Coach",
      createdAt: new Date().toISOString(),
      summaries: history.summaries.slice(0, 20),
    });
    if (reportId) setReportUrl(`${window.location.origin}/r/${reportId}`);
    else setError("Couldn't create the report.");
  }

  if (loading || (user && !ready)) return <h1 className="h1">Player</h1>;
  if (!user) return <Message />;
  if (!history) return <Message text={error ?? "This player isn't in one of your squads."} />;

  return (
    <div>
      <Link href="/coach" style={{ color: "var(--green)", fontWeight: 600, fontSize: 13 }}>← Roster</Link>
      <h1 className="h1" style={{ marginTop: 12 }}>{history.display_name}</h1>
      <p className="lead">Summary history and the analyses this player chose to share.</p>

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <Stat value={history.summaries.length} label="Sessions" />
        <Stat value={average ?? "--"} label="Average score" />
        <Stat value={history.summaries.reduce((n, s) => n + s.drills_completed, 0)} label="Practice completed" />
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Score line</div>
        {scores.length ? <div className="score-line" aria-label="Form score history">
          {scores.slice().reverse().map((s) => <span key={s.id} style={{ height: `${Math.max(4, s.form_score ?? 0)}%` }} title={`${s.form_score}/100`} />)}
        </div> : <p style={{ color: "var(--ink-soft)" }}>No scored sessions yet.</p>}
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Shared analyses</div>
        {!shares.length ? <p style={{ color: "var(--ink-soft)" }}>This player hasn&apos;t shared a breakdown yet.</p> : shares.map((share) => (
          <SharedAnalysis key={share.id} share={share} onSave={note} />
        ))}
      </div>

      <div className="card">
        <div className="card-title">Parent report</div>
        <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 12 }}>Create a private-by-link, 30-day snapshot with recent scores and practice.</p>
        {reportUrl ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input className="select" readOnly value={reportUrl} style={{ flex: 1 }} /><button className="btn" onClick={() => navigator.clipboard.writeText(reportUrl)}>Copy link</button></div>
          : <button className="btn" onClick={report}>Create parent report</button>}
        {error && <div role="alert" style={{ color: "var(--danger)", marginTop: 10 }}>{error}</div>}
      </div>
    </div>
  );
}

function SharedAnalysis({ share, onSave }: { share: CoachAnalysisShare; onSave: (id: string, note: string) => Promise<boolean> }) {
  const [note, setNote] = useState(share.coach_note ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  async function save() { setState("saving"); setState(await onSave(share.id, note) ? "saved" : "failed"); }
  return <div className="subcard" style={{ marginTop: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><strong>{share.payload.stroke}</strong><span className="pill">{share.payload.formScore}/100</span></div>
    <p style={{ color: "var(--ink-soft)", fontSize: 13, margin: "8px 0" }}>{share.payload.flaws.map((f) => f.label).join(" · ") || "No major flags"}</p>
    <label className="label" htmlFor={`note-${share.id}`}>Coach note</label>
    <textarea id={`note-${share.id}`} className="select" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} style={{ width: "100%", minHeight: 84, resize: "vertical" }} />
    <button className="btn btn-ghost" onClick={save} disabled={state === "saving"} style={{ marginTop: 8 }}>{state === "saved" ? "Saved" : state === "saving" ? "Saving..." : "Save note"}</button>
    {state === "failed" && <span role="alert" style={{ color: "var(--danger)", fontSize: 13, marginLeft: 10 }}>Couldn&apos;t save.</span>}
  </div>;
}

function Stat({ value, label }: { value: string | number; label: string }) { return <div className="stat"><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>; }
function Message({ text = "Sign in as a coach to view this player." }: { text?: string }) { return <div><h1 className="h1">Player</h1><div className="card"><p>{text}</p><Link className="btn" href="/account" style={{ marginTop: 12 }}>Open account</Link></div></div>; }
