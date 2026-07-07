"use client";

import { useState } from "react";
import Link from "next/link";

type State = "idle" | "busy" | "done" | "error";

// Guardian-facing approve control. Posts the raw token to /api/consent/approve;
// the server verifies it's single-use and unexpired before flipping the account
// to 'approved'. We show plainly what does and doesn't get shared so consent is
// informed, per the build spec's minors requirement.
export default function ConsentApprove({ token }: { token: string }) {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setState("busy");
    setError(null);
    try {
      const res = await fetch("/api/consent/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        setState("done");
      } else {
        const msg = await res.text().catch(() => "");
        setError(msg || "That didn't work. The link may be invalid or expired.");
        setState("error");
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="card" role="status">
        <div className="card-title" style={{ color: "var(--good)" }}>✓ Approved</div>
        <p style={{ color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.6 }}>
          Thank you. Your player&apos;s account is now active and can share summary progress with
          their coach. You can withdraw this at any time by asking them to leave their squad or
          delete their account — either one removes the synced data.
        </p>
        <Link href="/" className="btn btn-ghost" style={{ marginTop: 14 }}>Visit TopSpin</Link>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">What you&apos;re approving</div>
      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10, margin: "8px 0 18px" }}>
        <li style={{ display: "flex", gap: 10, fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.55 }}>
          <span style={{ color: "var(--court)", fontWeight: 800 }}>✓</span>
          <span><strong style={{ color: "var(--ink)" }}>Shared:</strong> a summary of practice —
            form scores, drills completed, and dates — visible only to their chosen coach.</span>
        </li>
        <li style={{ display: "flex", gap: 10, fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.55 }}>
          <span style={{ color: "var(--danger)", fontWeight: 800 }}>✕</span>
          <span><strong style={{ color: "var(--ink)" }}>Never shared:</strong> video clips or the
            full stroke breakdown — those stay on their device unless they choose to send a
            specific clip.</span>
        </li>
      </ul>
      {state === "error" && (
        <div role="alert" style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>⚠ {error}</div>
      )}
      <button className="btn" onClick={approve} disabled={state === "busy"} style={{ justifyContent: "center" }}>
        {state === "busy" ? "…" : "I approve — connect them with their coach"}
      </button>
      <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 12, lineHeight: 1.5 }}>
        If you weren&apos;t expecting this, you can safely close this page — nothing will sync.
      </p>
    </div>
  );
}
