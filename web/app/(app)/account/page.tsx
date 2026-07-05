"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { getSessions, getMyProfile, setMyProfile } from "@/lib/history";

const PERKS = [
  ["Save every analysis", "Your form scores and flaws are kept, so you can look back."],
  ["Track your progress", "Watch your form trend climb over weeks, not guess at it."],
  ["Train your weak spots", "Turn your recurring flaws into a session in one click."],
  ["Share with a coach", "Send a clean one-page summary before your next lesson."],
];

export default function Account() {
  const { user, enabled, loading, signIn, signUp, signInWithGoogle, resend, signOut } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [savedProfile, setSavedProfile] = useState(false);

  useEffect(() => {
    if (!user) return;
    getSessions(200).then((r) => setCount(r.length));
    getMyProfile().then((p) => { if (p) { setIsPublic(p.is_public); setDisplayName(p.display_name ?? ""); } });
  }, [user]);

  async function saveProfile(pub: boolean) {
    setIsPublic(pub);
    await setMyProfile(pub, displayName);
    setSavedProfile(true);
    setTimeout(() => setSavedProfile(false), 1500);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null); setOk(null);
    const err = mode === "in" ? await signIn(email, pw) : await signUp(email, pw);
    if (err) setMsg(err);
    else if (mode === "up") setOk("Almost there — check your email for a confirmation link, then sign in.");
    setBusy(false);
  }

  async function clearHistory() {
    if (!supabase || !user) return;
    if (!confirm("Delete all your saved analyses? This can't be undone.")) return;
    await supabase.from("sessions").delete().eq("user_id", user.id);
    setCount(0);
  }

  if (!enabled) return <Bare title="Account" body="Accounts aren't set up on this deployment yet." />;
  if (loading) return <div className="h1">Account</div>;

  // ---- signed in ----
  if (user) {
    const initial = (user.email ?? "?").charAt(0).toUpperCase();
    return (
      <div>
        <div className="h1">Your account</div>
        <p className="lead">Everything you analyse is saved here so you can track it over time.</p>

        <div className="card" style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--accent)", border: "2px solid var(--ink)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800, flexShrink: 0 }}>{initial}</div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{user.email}</div>
            <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>
              {count === null ? "…" : `${count} ${count === 1 ? "analysis" : "analyses"} saved`}
            </div>
          </div>
          <button className="btn btn-ghost" onClick={() => signOut()}>Sign out</button>
        </div>

        <div className="grid grid-3" style={{ marginBottom: 18 }}>
          <QuickCard href="/analyze" title="Analyse a clip" desc="Upload a stroke and get a fresh read." />
          <QuickCard href="/progress" title="View progress" desc="Your form trend and history." />
          <QuickCard href="/workouts" title="Build a session" desc="Drills for what you're working on." />
        </div>

        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-title">Public profile</div>
          <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 12 }}>
            Make your progress shareable and anyone with the link can see your form trend and stats
            (never your email). Turn it off any time.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
            <div>
              <label className="label" htmlFor="dname">Display name (optional)</label>
              <input id="dname" className="select" style={{ textTransform: "none" }} value={displayName}
                onChange={(e) => setDisplayName(e.target.value)} maxLength={40} placeholder="e.g. Alex" />
            </div>
            <button className={`btn ${isPublic ? "btn-ghost" : ""}`} onClick={() => saveProfile(!isPublic)}>
              {isPublic ? "Make private" : "Make profile public"}
            </button>
            {savedProfile && <span style={{ color: "var(--good)", fontSize: 13 }}>✓ Saved</span>}
          </div>
          {isPublic && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input className="select" style={{ flex: 1, minWidth: 240, textTransform: "none" }} readOnly
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/u/${user.id}`}
                onFocus={(e) => e.target.select()} />
              <button className="btn btn-ghost" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/u/${user.id}`)}>Copy link</button>
              <a className="btn" href={`/u/${user.id}`} target="_blank" rel="noreferrer">View</a>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Your data</div>
          <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 12 }}>
            We store your email and your saved analyses. Clips are never uploaded. You can wipe your history any time.
          </p>
          <button className="btn btn-ghost" style={{ borderColor: "var(--danger)", color: "var(--danger)" }} onClick={clearHistory}>
            Delete my saved analyses
          </button>
        </div>
      </div>
    );
  }

  // ---- signed out ----
  return (
    <div>
      <div className="h1">{mode === "in" ? "Welcome back" : "Create your account"}</div>
      <p className="lead">It&apos;s free, takes a few seconds, and keeps your progress in one place.</p>

      <div className="grid stack-mobile" style={{ gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
        <form onSubmit={submit} className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <button type="button" className="btn btn-ghost" style={{ justifyContent: "center", gap: 10 }}
            onClick={() => signInWithGoogle()}>
            <span style={{ fontWeight: 800, color: "var(--court)" }}>G</span> Continue with Google
          </button>
          <div style={{ textAlign: "center", fontSize: 12, color: "var(--ink-soft)" }}>or with email</div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" className="select" style={{ width: "100%" }} type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} autoComplete="email"
              autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="you@example.com" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" className="select" style={{ width: "100%" }} type="password" required minLength={6} value={pw}
              onChange={(e) => setPw(e.target.value)} placeholder="At least 6 characters"
              autoComplete={mode === "in" ? "current-password" : "new-password"} />
          </div>
          {msg && <div role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>⚠ {msg}</div>}
          {ok && <div role="status" style={{ color: "var(--good)", fontSize: 13 }}>✓ {ok}</div>}
          {msg && /confirm/i.test(msg) && (
            <button type="button" className="btn btn-ghost" style={{ justifyContent: "center", fontSize: 13 }}
              onClick={async () => { const r = await resend(email); setOk(r ? null : "Confirmation email resent."); setMsg(r); }}>
              Resend confirmation email
            </button>
          )}
          <button className="btn" disabled={busy} style={{ justifyContent: "center" }}>
            {busy ? "…" : mode === "in" ? "Sign in" : "Create account"}
          </button>
          <button type="button" className="btn btn-ghost" style={{ justifyContent: "center" }}
            onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); setOk(null); }}>
            {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </form>

        <div className="card acct-perks">
          <div className="card-title">What you get</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {PERKS.map(([t, d]) => (
              <div key={t} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: "var(--court)", fontWeight: 800, fontSize: 16, lineHeight: 1.3 }}>›</span>
                <div>
                  <div style={{ fontWeight: 650, fontSize: 14 }}>{t}</div>
                  <div style={{ color: "var(--ink-soft)", fontSize: 13, lineHeight: 1.5 }}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="card lift" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{title} →</div>
      <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>{desc}</div>
    </Link>
  );
}

function Bare({ title, body }: { title: string; body: string }) {
  return <div><div className="h1">{title}</div><p className="lead">{body}</p></div>;
}
