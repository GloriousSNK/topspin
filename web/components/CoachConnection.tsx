"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  chooseRole, createSquad, getCoachContext, joinSquad, leaveSquad,
  type AccountRole, type CoachContext,
} from "@/lib/coach";

export default function CoachConnection({ userId, consentReady }: { userId: string; consentReady: boolean }) {
  const { refreshRole } = useAuth();
  const [context, setContext] = useState<CoachContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [squadName, setSquadName] = useState("My squad");
  const owner = useRef(userId);

  useEffect(() => {
    owner.current = userId;
    let alive = true;
    getCoachContext(userId).then((value) => {
      if (alive && owner.current === userId) setContext(value);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId]);

  async function setRole(role: AccountRole) {
    setBusy(true); setMessage(null);
    const value = await chooseRole(userId, role);
    if (owner.current !== userId) return;
    if (!value) setMessage("Couldn't set up that account type. Try again.");
    else {
      setContext({ role: value, squads: [], membership: null });
      refreshRole();
    }
    setBusy(false);
  }

  async function makeSquad() {
    setBusy(true); setMessage(null);
    const result = await createSquad(userId, squadName);
    if (owner.current !== userId) return;
    if (!result.squad) {
      setMessage(result.error === "setup"
        ? "Squad setup needs the latest database migration."
        : result.error === "permission"
          ? "This account isn't set up as a coach."
          : result.error === "session"
            ? "Your session expired. Sign in again."
            : "Couldn't create the squad. Try again.");
    } else {
      setContext((c) => c ? { ...c, squads: [...c.squads, result.squad!] } : c);
    }
    setBusy(false);
  }

  async function join() {
    setBusy(true); setMessage(null);
    const membership = await joinSquad(userId, code);
    if (owner.current !== userId) return;
    if (!membership) setMessage("That code didn't work. Check it and try again.");
    else { setContext((c) => c ? { ...c, membership } : c); setCode(""); }
    setBusy(false);
  }

  async function leave() {
    if (!confirm("Leave this squad? Coach-visible summaries and shared analyses will be deleted.")) return;
    setBusy(true); setMessage(null);
    const ok = await leaveSquad(userId);
    if (owner.current !== userId) return;
    if (!ok) setMessage("Couldn't leave the squad. Nothing was changed.");
    else setContext((c) => c ? { ...c, membership: null } : c);
    setBusy(false);
  }

  return (
    <section id="coach-connection" className="card" style={{ marginBottom: 18, scrollMarginTop: 88 }} aria-labelledby="coach-connection-title">
      <div className="card-title">Coach connection</div>
      <h2 id="coach-connection-title" style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 25, fontWeight: 500, marginBottom: 8 }}>
        Train together, only when you choose to
      </h2>
      <p style={{ color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
        TopSpin works without this. Connecting only syncs scores, completed practice, and dates. Clips stay on your device unless you share an analysis yourself.
      </p>

      {!consentReady ? (
        <div className="subcard">Guardian approval is needed before coach sync can start.</div>
      ) : loading ? (
        <div role="status" style={{ color: "var(--ink-soft)" }}>Loading...</div>
      ) : !context?.role ? (
        <div className="grid grid-2">
          <button className="subcard lift" style={{ textAlign: "left", cursor: "pointer" }} disabled={busy} onClick={() => setRole("player")}>
            <strong style={{ display: "block", marginBottom: 5 }}>I&apos;m a player</strong>
            <span style={{ color: "var(--ink-soft)", fontSize: 13 }}>Join one coach using their squad code.</span>
          </button>
          <button className="subcard lift" style={{ textAlign: "left", cursor: "pointer" }} disabled={busy} onClick={() => setRole("coach")}>
            <strong style={{ display: "block", marginBottom: 5 }}>I&apos;m a coach</strong>
            <span style={{ color: "var(--ink-soft)", fontSize: 13 }}>Create squads and follow player summaries.</span>
          </button>
        </div>
      ) : context.role === "player" ? (
        context.membership ? (
          <div className="subcard" style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div>
              <strong>{context.membership.squad_name}</strong>
              <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>Connected to {context.membership.coach_name}</div>
            </div>
            <button className="btn btn-ghost" style={{ color: "var(--danger)" }} disabled={busy} onClick={leave}>Leave squad</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 220px" }}>
              <label className="label" htmlFor="squad-code">Squad code</label>
              <input id="squad-code" className="select" value={code} maxLength={6} autoCapitalize="characters" spellCheck={false}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="A1B2C3" style={{ width: "100%" }} />
            </div>
            <button className="btn" disabled={busy || code.length !== 6} onClick={join}>Join squad</button>
          </div>
        )
      ) : (
        <div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
            <div style={{ flex: "1 1 220px" }}>
              <label className="label" htmlFor="squad-name">New squad name</label>
              <input id="squad-name" className="select" value={squadName} maxLength={60} onChange={(e) => setSquadName(e.target.value)} style={{ width: "100%" }} />
            </div>
            <button className="btn" disabled={busy || !squadName.trim()} onClick={makeSquad}>Create squad</button>
            <Link className="btn btn-ghost" href="/coach">Open coach dashboard</Link>
          </div>
          <div className="grid grid-3">
            {context.squads.map((s) => (
              <div key={s.id} className="subcard">
                <strong>{s.name}</strong>
                <div className="mono" style={{ color: "var(--green)", fontSize: 20, marginTop: 6, letterSpacing: "0.12em" }}>{s.code}</div>
              </div>
            ))}
            {!context.squads.length && <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>No squads yet.</div>}
          </div>
        </div>
      )}
      {message && <div role="alert" style={{ color: "var(--danger)", fontSize: 13, marginTop: 12 }}>{message}</div>}
    </section>
  );
}
