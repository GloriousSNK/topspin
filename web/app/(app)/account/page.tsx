"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function Account() {
  const { user, enabled, loading, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null); setOk(null);
    const err = mode === "in" ? await signIn(email, pw) : await signUp(email, pw);
    if (err) setMsg(err);
    else if (mode === "up") setOk("Account created. Check your email if confirmation is on, then sign in.");
    setBusy(false);
  }

  if (!enabled) {
    return (
      <div>
        <div className="h1">Account</div>
        <p className="lead">Accounts aren&apos;t set up on this deployment yet.</p>
      </div>
    );
  }

  if (loading) return <div className="h1">Account</div>;

  if (user) {
    return (
      <div>
        <div className="h1">Your account</div>
        <p className="lead">Signed in as {user.email}. Your analyses are saved to your history.</p>
        <div className="card" style={{ maxWidth: 440 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/progress" className="btn">View my progress</Link>
            <button className="btn btn-ghost" onClick={() => signOut()}>Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="h1">{mode === "in" ? "Sign in" : "Create an account"}</div>
      <p className="lead">Save your analyses, track progress over time, and share summaries with a coach.</p>

      <form onSubmit={submit} className="card" style={{ maxWidth: 440, display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label className="label">Email</label>
          <input className="select" style={{ width: "100%" }} type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="select" style={{ width: "100%" }} type="password" required minLength={6} value={pw}
            onChange={(e) => setPw(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} />
        </div>
        {msg && <div style={{ color: "var(--danger)", fontSize: 13 }}>{msg}</div>}
        {ok && <div style={{ color: "var(--good)", fontSize: 13 }}>{ok}</div>}
        <button className="btn" disabled={busy} style={{ justifyContent: "center" }}>
          {busy ? "…" : mode === "in" ? "Sign in" : "Create account"}
        </button>
        <button type="button" className="btn btn-ghost" style={{ justifyContent: "center" }}
          onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); setOk(null); }}>
          {mode === "in" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
