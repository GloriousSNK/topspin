"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getCoachContext, getCoachRoster, type RosterPlayer } from "@/lib/coach";

export default function CoachDashboard() {
  const { user, loading } = useAuth();
  const [players, setPlayers] = useState<RosterPlayer[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "forbidden" | "error">("loading");

  useEffect(() => {
    if (!user) return;
    let alive = true;
    Promise.all([getCoachContext(user.id), getCoachRoster(user.id)]).then(([context, roster]) => {
      if (!alive) return;
      if (context?.role !== "coach") setState("forbidden");
      else { setPlayers(roster); setState("ready"); }
    }).catch(() => { if (alive) setState("error"); });
    return () => { alive = false; };
  }, [user]);

  if (loading || (user && state === "loading")) return <h1 className="h1">Coach dashboard</h1>;
  if (!user) return <Message text="Sign in with a coach account to open your roster." />;
  if (state === "forbidden") return <Message text="This account is set up as a player. Coach accounts get the roster dashboard." />;
  if (state === "error") return <Message text="We couldn't load the roster. Refresh and try again." />;

  return (
    <div>
      <span className="eyebrow">Coach desk</span>
      <h1 className="h1">Your roster</h1>
      <p className="lead">A quick read on who trained, where scores are moving, and who may need a check-in.</p>

      {!players.length ? (
        <div className="card" style={{ textAlign: "center", padding: "44px 24px" }}>
          <h2 style={{ fontFamily: "var(--font-display), Georgia, serif", fontWeight: 500, marginBottom: 8 }}>Your squad is ready</h2>
          <p style={{ color: "var(--ink-soft)", marginBottom: 18 }}>Share the six-character code from your Account page. Players appear here after they join.</p>
          <Link className="btn" href="/account">View squad codes</Link>
        </div>
      ) : (
        <div className="roster-list">
          {players.map((player) => (
            <Link key={player.player_id} href={`/coach/player/${player.player_id}`} className="roster-row lift">
              <div className="roster-avatar">{player.display_name.charAt(0).toUpperCase()}</div>
              <div className="roster-main">
                <strong>{player.display_name}</strong>
                <span>{player.squad_name}</span>
              </div>
              <div className="roster-metric"><span>Latest</span><strong>{player.latest_score ?? "--"}</strong></div>
              <div className={`trend trend-${player.trend}`}>{player.trend}</div>
              <time>{player.last_active ? new Date(player.last_active).toLocaleDateString() : "No sessions"}</time>
              <span aria-hidden="true">›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Message({ text }: { text: string }) {
  return <div><h1 className="h1">Coach dashboard</h1><div className="card"><p style={{ color: "var(--ink-soft)" }}>{text}</p><Link href="/account" className="btn" style={{ marginTop: 14 }}>Open account</Link></div></div>;
}
