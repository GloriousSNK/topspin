"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import CoachConnection from "@/components/CoachConnection";
import { deleteSessions, getSessions, getMyProfile, setMyProfile } from "@/lib/history";
import {
  getMyConsent, submitAgeGate, resendGuardianRequest, needsGuardianConsent,
  type ConsentRow,
} from "@/lib/consent";

const PERKS = [
  ["Save every analysis", "Your form scores and flaws are kept, so you can look back."],
  ["Track your progress", "Watch your form trend climb over weeks, not guess at it."],
  ["Train your weak spots", "Turn your recurring flaws into a session in one click."],
  ["Share with a coach", "Send a clean one-page summary before your next lesson."],
];

export default function Account() {
  const { user, enabled, loading, signIn, signUp, signInWithMagicLink, signInWithGoogle, resend, signOut } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [utr, setUtr] = useState("");
  const [usta, setUsta] = useState("");
  const [savedProfile, setSavedProfile] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [consent, setConsent] = useState<ConsentRow | null>(null);
  const [consentLoaded, setConsentLoaded] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [accountLoadError, setAccountLoadError] = useState(false);
  const activeUserId = useRef<string | null>(user?.id ?? null);

  useEffect(() => {
    // Reset every per-account field first so nothing from a previously
    // signed-in account bleeds into this one. Without this, switching to an
    // account that has no public profile would keep the prior user's display
    // name / UTR / public-toggle in the form — and "Save details" would write
    // them onto the new account. Deliberate one-time reset keyed on identity.
    activeUserId.current = user?.id ?? null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset account-scoped UI on identity change
    setCount(null); setConsent(null); setConsentLoaded(false); setProfileLoaded(false); setAccountLoadError(false);
    setIsPublic(false); setDisplayName(""); setUtr(""); setUsta(""); setSavedProfile(false);
    if (!user) return;
    let alive = true;
    getSessions(user.id, 200).then((r) => { if (alive) setCount(r.length); });
    getMyProfile(user.id).then((p) => {
      if (!alive || !p) return;
      setIsPublic(p.is_public); setDisplayName(p.display_name ?? ""); setUtr(p.utr ?? ""); setUsta(p.usta ?? "");
    }).catch(() => { if (alive) setAccountLoadError(true); })
      .finally(() => { if (alive) setProfileLoaded(true); });
    getMyConsent(user.id).then((c) => { if (alive) setConsent(c); })
      .catch(() => { if (alive) setAccountLoadError(true); })
      .finally(() => { if (alive) setConsentLoaded(true); });
    return () => { alive = false; };
  }, [user]);

  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get("authError");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL state is external input
    if (authError) setMsg(authError);
  }, []);

  async function saveProfile(pub: boolean) {
    if (!user) return;
    const ownerId = user.id;
    const ok = await setMyProfile(ownerId, pub, displayName, utr, usta);
    if (activeUserId.current !== ownerId) return;
    if (!ok) { setMsg("Couldn't save your profile. Try again."); return; }
    setIsPublic(pub);
    setSavedProfile(true);
    setTimeout(() => setSavedProfile(false), 1500);
  }

  function copyProfileLink() {
    if (!user) return;
    navigator.clipboard?.writeText(`${window.location.origin}/u/${user.id}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null); setOk(null);
    const err = mode === "in" ? await signIn(email, pw) : await signUp(email, pw);
    if (err) setMsg(err);
    else if (mode === "up") setOk("Almost there — check your email for a confirmation link, then sign in.");
    setPw("");
    setBusy(false);
  }

  async function magicLink() {
    setBusy(true); setMsg(null); setOk(null);
    if (!email.trim()) {
      setMsg("Enter your email first."); setBusy(false); return;
    }
    const err = await signInWithMagicLink(email.trim());
    if (err) setMsg(err);
    else setOk("Check your email for a secure sign-in link.");
    setBusy(false);
  }

  async function clearHistory() {
    if (!user) return;
    if (!confirm("Delete all your saved analyses? This can't be undone.")) return;
    const ownerId = user.id;
    const ok = await deleteSessions(ownerId);
    if (activeUserId.current !== ownerId) return;
    if (ok) setCount(0);
    else setMsg("Couldn't delete your analyses. Nothing was changed.");
  }

  async function deleteAccount() {
    if (!user) return;
    if (!confirm("Permanently delete your TopSpin account and all synced data? This cannot be undone.")) return;
    setBusy(true); setMsg(null);
    try {
      const response = await fetch("/api/account/delete", { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        setMsg(body?.error ?? "Couldn't delete your account. Nothing was changed.");
        return;
      }
      await signOut();
      window.location.assign("/");
    } catch {
      setMsg("Couldn't reach the server. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return (
    <Bare
      title="Account"
      body="Accounts aren't connected on this copy of the app. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to web/.env.local (from your Supabase project's Settings → API), restart the dev server, and sign-in will light up."
    />
  );
  if (loading) return <h1 className="h1">Account</h1>;

  // ---- signed in ----
  if (user) {
    const initial = (user.email ?? "?").charAt(0).toUpperCase();

    // Wait for the consent row before deciding what to show, so a user who
    // still needs the age gate doesn't see the account flash first.
    if (!consentLoaded || !profileLoaded) return <h1 className="h1">Account</h1>;
    if (accountLoadError) return <Bare title="Account" body="We couldn't load your account details. Refresh the page and try again." />;

    // One-time age gate: a fresh account tells us its birth year before the
    // account is usable, so minors are routed through guardian consent
    // (COPPA/GDPR). The whole app stays usable account-free for anyone who'd
    // rather not make an account at all.
    if (!consent) {
      return <AgeGate userId={user.id} email={user.email ?? ""} onDone={setConsent} onSignOut={() => signOut()} />;
    }

    const pending = consent.consent_status === "pending";
    return (
      <div>
        {pending && (
          <PendingConsentBanner
            guardianEmail={consent.guardian_email ?? ""}
            onResend={resendGuardianRequest}
          />
        )}
        <span className="eyebrow">Your locker</span>
        <h1 className="h1">Your account</h1>
        <p className="lead">Everything you analyse is saved here so you can track it over time.</p>

        <div className="card" style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--accent)", border: "1px solid rgba(29,34,27,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800, flexShrink: 0 }}>{initial}</div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{user.email}</div>
            <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>
              {count === null ? "…" : `${count} ${count === 1 ? "analysis" : "analyses"} saved`}
            </div>
          </div>
          <button className="btn btn-ghost" onClick={async () => { await signOut(); setPw(""); setEmail(""); }}>Sign out</button>
        </div>

        <div className="grid grid-3" style={{ marginBottom: 18 }}>
          <QuickCard href="/analyze" title="Analyse a clip" desc="Upload a stroke and get a fresh read." />
          <QuickCard href="/stats" title="View stats" desc="Your form trend, history and saved drills." />
          <QuickCard href="/workouts" title="Build a session" desc="Drills for what you're working on." />
        </div>

        <CoachConnection userId={user.id} consentReady={!pending} />

        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-title">Public profile</div>
          <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 12 }}>
            Make your progress shareable and anyone with the link can see your form trend and stats
            (never your email). Turn it off any time.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
            <div>
              <label className="label" htmlFor="dname">Display name</label>
              <input id="dname" className="select" style={{ textTransform: "none" }} value={displayName}
                onChange={(e) => setDisplayName(e.target.value)} maxLength={40} placeholder="e.g. Alex" />
            </div>
            <div>
              <label className="label" htmlFor="utr">UTR</label>
              <input id="utr" className="select" style={{ width: 90, textTransform: "none" }} value={utr}
                onChange={(e) => setUtr(e.target.value)} maxLength={5} placeholder="e.g. 6.5" />
            </div>
            <div>
              <label className="label" htmlFor="usta">USTA / NTRP</label>
              <input id="usta" className="select" style={{ width: 90, textTransform: "none" }} value={usta}
                onChange={(e) => setUsta(e.target.value)} maxLength={5} placeholder="e.g. 4.0" />
            </div>
            <button className="btn btn-ghost" onClick={() => saveProfile(isPublic)}>Save details</button>
            {savedProfile && <span style={{ color: "var(--good)", fontSize: 13 }}>✓ Saved</span>}
          </div>
          <button className={`btn ${isPublic ? "btn-ghost" : ""}`} onClick={() => saveProfile(!isPublic)} style={{ marginBottom: 12 }}>
            {isPublic ? "Make profile private" : "Make profile public"}
          </button>
          {isPublic && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input className="select" style={{ flex: 1, minWidth: 240, textTransform: "none" }} readOnly
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/u/${user.id}`}
                onFocus={(e) => e.target.select()} />
              <button className="btn btn-ghost" onClick={copyProfileLink}>{linkCopied ? "Copied!" : "Copy link"}</button>
              <a className="btn" href={`/u/${user.id}`} target="_blank" rel="noreferrer">View</a>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Your data</div>
          <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 12 }}>
            We store your email, your birth year, your saved analyses, and — only if you&apos;re under 16 —
            a guardian email for consent. Clips are never uploaded. You can wipe your history any time, and
            deleting your account removes all of it. See the{" "}
            <Link href="/privacy" style={{ color: "var(--court)", fontWeight: 600 }}>privacy page</Link>.
          </p>
          <button className="btn btn-ghost" style={{ borderColor: "var(--danger)", color: "var(--danger)" }} onClick={clearHistory}>
            Delete my saved analyses
          </button>
          <button className="btn btn-ghost" style={{ borderColor: "var(--danger)", color: "var(--danger)", marginLeft: 10 }}
            onClick={deleteAccount} disabled={busy}>
            Delete my account
          </button>
          {msg && <div role="alert" style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{msg}</div>}
        </div>
      </div>
    );
  }

  // ---- signed out ----
  return (
    <div>
      <span className="eyebrow">Members</span>
      <h1 className="h1">{mode === "in" ? "Welcome back" : "Create your account"}</h1>
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
          {mode === "in" && (
            <button type="button" className="btn btn-ghost" disabled={busy}
              style={{ justifyContent: "center" }} onClick={magicLink}>
              Email me a sign-in link
            </button>
          )}
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

// One-time age gate shown right after a new account's first sign-in. We store
// only a birth YEAR (coarse, lower-data). The server re-derives whether a
// guardian is required — this form just reveals the guardian field early so a
// minor knows what's coming. See lib/consent.ts and the /api/consent routes.
function AgeGate({ userId, email, onDone, onSignOut }: {
  userId: string; email: string; onDone: (c: ConsentRow) => void; onSignOut: () => void;
}) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const yearNum = Number(year);
  const validYear = /^\d{4}$/.test(year) && yearNum >= thisYear - 120 && yearNum <= thisYear;
  const minor = validYear && needsGuardianConsent(yearNum);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await submitAgeGate(yearNum, minor ? guardianEmail : undefined);
    if (!r.ok) { setErr(r.error ?? "Something went wrong."); setBusy(false); return; }
    const c = await getMyConsent(userId);
    setBusy(false);
    if (c) onDone(c);
    else setErr("Saved, but couldn't reload. Refresh the page.");
  }

  return (
    <div>
      <span className="eyebrow">One quick thing</span>
      <h1 className="h1">Before we finish setting up</h1>
      <p className="lead">
        We ask everyone their birth year once. If you&apos;re under {16}, a parent or guardian just
        needs to say it&apos;s OK before you can connect with a coach — you can use everything else
        in the meantime.
      </p>

      <form onSubmit={submit} className="card" style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 460 }}>
        <div>
          <label className="label" htmlFor="birthyear">Birth year</label>
          <input id="birthyear" className="select" style={{ width: 140, textTransform: "none" }}
            inputMode="numeric" pattern="\d*" maxLength={4} value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="e.g. 2005" autoFocus />
        </div>

        {minor && (
          <div>
            <label className="label" htmlFor="guardian">Parent / guardian&apos;s email</label>
            <input id="guardian" className="select" style={{ width: "100%", textTransform: "none" }}
              type="email" required value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value)}
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              placeholder="parent@example.com" />
            <p style={{ color: "var(--ink-soft)", fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
              We&apos;ll email them a link to approve. Nothing syncs to a coach until they do.
            </p>
          </div>
        )}

        {err && <div role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>⚠ {err}</div>}

        <button className="btn" disabled={busy || !validYear || (minor && !guardianEmail)} style={{ justifyContent: "center" }}>
          {busy ? "…" : "Save and continue"}
        </button>
        <button type="button" className="btn btn-ghost" style={{ justifyContent: "center", fontSize: 13 }} onClick={onSignOut}>
          Sign out of {email || "this account"}
        </button>
      </form>
    </div>
  );
}

// Shown while a minor's account is waiting on guardian approval. The account
// exists and the on-device app works; only coach sync/join is blocked (enforced
// server-side by RLS, not just here).
function PendingConsentBanner({ guardianEmail, onResend }: {
  guardianEmail: string; onResend: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  async function resend() {
    setState("busy"); setErr(null);
    const r = await onResend();
    if (r.ok) setState("sent");
    else { setErr(r.error ?? "Couldn't send."); setState("error"); }
  }

  return (
    <div className="card" role="status" style={{ marginBottom: 18, borderColor: "var(--court)" }}>
      <div className="card-title">Waiting on a parent or guardian</div>
      <p style={{ color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
        We emailed {guardianEmail ? <strong style={{ color: "var(--ink)" }}>{guardianEmail}</strong> : "your guardian"} a
        link to approve your account. Until they do, you can analyse clips, run drills, and use the
        Ball Lab as normal — you just can&apos;t connect with a coach yet.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn btn-ghost" onClick={resend} disabled={state === "busy" || state === "sent"}>
          {state === "busy" ? "…" : state === "sent" ? "✓ Sent again" : "Resend approval email"}
        </button>
        {state === "error" && <span style={{ color: "var(--danger)", fontSize: 13 }}>⚠ {err}</span>}
      </div>
    </div>
  );
}

function Bare({ title, body }: { title: string; body: string }) {
  return <div><h1 className="h1">{title}</h1><p className="lead">{body}</p></div>;
}
