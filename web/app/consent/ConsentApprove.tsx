"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type State = "loading" | "idle" | "busy" | "done" | "error";

export default function ConsentApprove() {
  const [state, setState] = useState<State>("loading");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    window.history.replaceState(null, "", "/consent");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initialize from the one-time URL fragment
    setToken(raw);
    setState(raw && raw.length <= 200 ? "idle" : "error");
    if (!raw || raw.length > 200) setError("This approval link is missing or malformed.");
  }, []);

  async function approve() {
    setState("busy"); setError(null);
    try {
      const res = await fetch("/api/consent/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) setState("done");
      else {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        setError(body?.error ?? "That didn't work. The link may be invalid or expired.");
        setState("error");
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setState("error");
    }
  }

  if (state === "loading") return <div className="card">Loading approval…</div>;
  if (state === "done") return (
    <div className="card" role="status">
      <div className="card-title" style={{ color: "var(--good)" }}>Approved</div>
      <p style={{ color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.6 }}>
        Thank you. Your player can now share summary progress with their coach. They can stop
        sharing at any time by leaving their squad or deleting their account.
      </p>
      <Link href="/" className="btn btn-ghost" style={{ marginTop: 14 }}>Visit TopSpin</Link>
    </div>
  );

  return (
    <div className="card">
      <div className="card-title">What you&apos;re approving</div>
      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10, margin: "8px 0 18px" }}>
        <li style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.55 }}>
          <strong style={{ color: "var(--ink)" }}>Shared:</strong> practice scores, completed drills, and dates with their chosen coach.
        </li>
        <li style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.55 }}>
          <strong style={{ color: "var(--ink)" }}>Not shared:</strong> video clips or the full stroke breakdown unless the player deliberately sends one.
        </li>
      </ul>
      {error && <div role="alert" style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <button className="btn" onClick={approve} disabled={state === "busy" || !token} style={{ justifyContent: "center" }}>
        {state === "busy" ? "Approving…" : "I approve"}
      </button>
      <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 12, lineHeight: 1.5 }}>
        If you weren&apos;t expecting this, close the page. Nothing will sync.
      </p>
    </div>
  );
}
