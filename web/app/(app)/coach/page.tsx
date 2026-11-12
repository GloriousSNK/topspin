"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getCoachRoster, type RosterPlayer } from "@/lib/coach";
import PageSkeleton from "../_components/PageSkeleton";

export default function CoachDashboard() {
  const { user, loading, role, roleLoading } = useAuth();
  const userId = user?.id ?? null;
  // Results are tagged with the account they were fetched for, so another
  // account's roster can never show while a refetch is in flight.
  const [roster, setRoster] = useState<{ userId: string; players: RosterPlayer[] | null } | null>(null);

  // The role comes from AuthProvider (already fetched once per sign-in), so this
  // page only needs the roster itself: one request instead of two. The roster
  // RPC is coach-gated server-side either way.
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    getCoachRoster(userId)
      .then((players) => { if (alive) setRoster({ userId, players }); })
      .catch(() => { if (alive) setRoster({ userId, players: null }); });
    return () => { alive = false; };
  }, [userId]);

  const mine = roster && roster.userId === userId ? roster : null;
  const state = !user || roleLoading ? "loading"
    : role !== "coach" ? "forbidden"
    : !mine ? "loading"
    : mine.players ? "ready" : "error";
  const players = mine?.players ?? [];

  if (loading || (user && state === "loading")) {
    return <PageSkeleton eyebrow="Coach desk" title="Your roster"
      lead="A quick read on who trained, where scores are moving, and who may need a check-in." blocks={[72, 72, 72]} />;
  }
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
