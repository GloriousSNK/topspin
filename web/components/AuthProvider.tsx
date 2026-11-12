"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User, SupabaseClient } from "@supabase/supabase-js";
import type { AccountRole } from "@/lib/coach";
import { getSupabase } from "@/lib/supabaseLazy";
import { onIdle } from "@/lib/idle";

interface AuthState {
  user: User | null;
  role: AccountRole | null;
  roleLoading: boolean;
  loading: boolean;
  enabled: boolean;
  refreshRole: () => void;
  signUp: (email: string, password: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signInWithMagicLink: (email: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<void>;
  resend: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const notConfigured = "Accounts are not configured.";

// Known synchronously from build-inlined env vars — lets us decide render state
// (and skip loading the SDK entirely) without importing @supabase/supabase-js.
const enabled = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Lazily import the Supabase client so its ~230KB SDK stays out of the initial
// shared bundle — marketing pages don't pay for it up front. It's fetched (once,
// memoised, shared with the data helpers) only for visitors with a session
// cookie, or on demand when someone starts signing in.
function loadClient(): Promise<SupabaseClient | null> {
  return enabled ? getSupabase() : Promise.resolve(null);
}

// @supabase/ssr keeps the session in `sb-<ref>-auth-token` (chunked as `.0`,
// `.1`, … when large). No such cookie means nobody is signed in on this
// browser, so there's nothing to restore and no reason to load the SDK yet.
const AUTH_COOKIE = /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/;
function hasAuthCookie(): boolean {
  try { return AUTH_COOKIE.test(document.cookie); } catch { return true; }
}

const Ctx = createContext<AuthState>({
  user: null, role: null, roleLoading: false, loading: true, enabled: false,
  refreshRole: () => {},
  signUp: async () => notConfigured,
  signIn: async () => notConfigured,
  signInWithMagicLink: async () => notConfigured,
  signInWithGoogle: async () => {},
  resend: async () => notConfigured,
  signOut: async () => {},
});

const origin = () => (typeof window !== "undefined" ? window.location.origin : "");
const callback = () => `${origin()}/auth/callback?next=/account`;

// Same account and nothing the UI shows has changed (updated_at moves on any
// profile/email change), so the existing object can be reused.
function sameUser(a: User | null, b: User | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.id === b.id && a.email === b.email && a.updated_at === b.updated_at;
}

// Turn Supabase's terse errors into something a person can act on.
function friendly(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("not confirmed")) return "Confirm your email first — check your inbox, or use Google below.";
  if (m.includes("invalid login")) return "Wrong email or password. If you just signed up, confirm your email first (or resend below).";
  if (m.includes("already registered")) return "That email already has an account — try signing in.";
  return msg;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roleState, setRoleState] = useState<{ userId: string | null; role: AccountRole | null; loaded: boolean }>({ userId: null, role: null, loaded: false });
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleVersion, setRoleVersion] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const clientRef = useRef<SupabaseClient | null>(null);
  const activeUserId = useRef<string | null>(null);

  // Supabase hands us a fresh User object for the same account several times
  // (cached session, server validation, INITIAL_SESSION, hourly TOKEN_REFRESHED).
  // Keep the previous object when nothing we render from has changed, so
  // consumers keyed on `user` don't re-render, refetch, or flash their skeleton.
  const applyUser = useCallback((next: User | null) => {
    const nextId = next?.id ?? null;
    if (activeUserId.current !== nextId) {
      activeUserId.current = nextId;
      setRoleState({ userId: nextId, role: null, loaded: false });
    }
    setUser((prev) => sameUser(prev, next) ? prev : next);
  }, []);

  // Load the client, restore the session and subscribe to auth changes — once
  // per mount. `generation` invalidates work from an unmounted (or StrictMode
  // double-mounted) effect so it can't subscribe twice or set stale state.
  const generation = useRef(0);
  const connection = useRef<Promise<SupabaseClient | null> | null>(null);
  const unsubscribe = useRef<() => void>(() => {});
  const connect = useCallback((): Promise<SupabaseClient | null> => {
    if (connection.current) return connection.current;
    const gen = generation.current;
    const live = () => gen === generation.current;
    const pending = loadClient().then((sb) => {
      if (!live()) return sb;
      clientRef.current = sb;
      if (!sb) { setLoading(false); return sb; }
      // Restore the signed-in UI from the cookie-backed local session first.
      // A server validation still runs immediately afterwards, but it no longer
      // blanks the app during a tab restore or a short network interruption.
      sb.auth.getSession().then(({ data }) => {
        if (!live()) return;
        const cachedUser = data.session?.user ?? null;
        if (cachedUser) {
          applyUser(cachedUser);
          setLoading(false);
        }
        return sb.auth.getUser().then(({ data: verified }) => {
          if (!live()) return;
          applyUser(verified.user ?? null);
          setLoading(false);
        });
      }).catch(() => {
        if (!live()) return;
        applyUser(null);
        setLoading(false);
      });
      const { data: sub } = sb.auth.onAuthStateChange((_e, s) => { if (live()) applyUser(s?.user ?? null); });
      unsubscribe.current = () => sub.subscription.unsubscribe();
      return sb;
    });
    pending.catch(() => {
      if (!live()) return;
      connection.current = null; // chunk failed to load; let the next action retry
      setLoading(false);
    });
    connection.current = pending;
    return pending;
  }, [applyUser]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- env config is external state
    if (!enabled) { setLoading(false); return; }
    const gen = ++generation.current;
    let cancel = () => {};
    if (hasAuthCookie()) {
      // Someone is signed in: restore after hydration has painted, not during it.
      cancel = onIdle(() => {
        if (gen !== generation.current) return;
        // Remove retired localStorage token copies from the pre-SSR auth client.
        try {
          for (const key of Object.keys(window.localStorage)) {
            if (/^sb-.*-auth-token(?:\.|$)/.test(key)) window.localStorage.removeItem(key);
          }
        } catch { /* storage unavailable */ }
        void connect();
      }, 500);
    } else {
      // Signed out: no SDK, no auth round trip. Sign-in actions connect on
      // demand; a sign-in from another tab is picked up when this one is focused.
      setLoading(false);
      const recheck = () => {
        if (document.visibilityState === "visible" && hasAuthCookie()) void connect();
      };
      document.addEventListener("visibilitychange", recheck);
      window.addEventListener("focus", recheck);
      cancel = () => {
        document.removeEventListener("visibilitychange", recheck);
        window.removeEventListener("focus", recheck);
      };
    }
    return () => {
      // Deliberately the live counter (not a DOM ref): bumping it invalidates
      // any in-flight connect() from this mount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      cancel();
      unsubscribe.current();
      unsubscribe.current = () => {};
      connection.current = null;
    };
  }, [connect]);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (!userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear identity-scoped state immediately
      setRoleLoading(false);
      return;
    }
    let alive = true;
    setRoleLoading(true);
    loadClient().then(async (sb) => {
      if (!sb) return { data: null, error: new Error("Supabase unavailable") };
      return sb.rpc("get_my_coach_context");
    }).then(({ data, error }) => {
      if (!alive || activeUserId.current !== userId) return;
      const value = data as { role?: AccountRole | null } | null;
      setRoleState({ userId, role: error ? null : value?.role ?? null, loaded: true });
    }).catch(() => {
      if (alive && activeUserId.current === userId) setRoleState({ userId, role: null, loaded: true });
    }).finally(() => {
      if (alive && activeUserId.current === userId) setRoleLoading(false);
    });
    return () => { alive = false; };
  }, [user?.id, roleVersion]);

  // Every action below is stable across renders (they only touch refs and
  // setters), so the memoised context value only changes when auth state does.
  // Actions connect on demand, so signing in works even when the SDK was never
  // loaded for this (previously signed-out) visit.
  const client = useCallback(async () => clientRef.current ?? (await connect()), [connect]);

  const signUp = useCallback(async (email: string, password: string) => {
    const sb = await client();
    if (!sb) return notConfigured;
    const { error } = await sb.auth.signUp({
      email, password, options: { emailRedirectTo: callback() },
    });
    return error ? friendly(error.message) : null;
  }, [client]);
  const signIn = useCallback(async (email: string, password: string) => {
    const sb = await client();
    if (!sb) return notConfigured;
    applyUser(null);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      const { data } = await sb.auth.getUser();
      applyUser(data.user ?? null);
    }
    return error ? friendly(error.message) : null;
  }, [client, applyUser]);
  const signInWithMagicLink = useCallback(async (email: string) => {
    const sb = await client();
    if (!sb) return notConfigured;
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback() },
    });
    return error ? friendly(error.message) : null;
  }, [client]);
  const signInWithGoogle = useCallback(async () => {
    const sb = await client();
    if (!sb) return;
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback() },
    });
  }, [client]);
  const resend = useCallback(async (email: string) => {
    const sb = await client();
    if (!sb) return notConfigured;
    const { error } = await sb.auth.resend({
      type: "signup", email, options: { emailRedirectTo: callback() },
    });
    return error ? friendly(error.message) : null;
  }, [client]);
  const signOut = useCallback(async () => {
    const sb = await client();
    const { error } = await sb?.auth.signOut() ?? { error: null };
    if (!error) applyUser(null);
  }, [client, applyUser]);

  const role = roleState.userId === user?.id ? roleState.role : null;
  // Also "loading" in the gap between a sign-in and the role request starting,
  // so role-gated pages never flash the wrong state for a frame.
  const rolePending = roleLoading || (!!user && !(roleState.userId === user.id && roleState.loaded));
  const refreshRole = useCallback(() => setRoleVersion((value) => value + 1), []);

  const value = useMemo<AuthState>(() => ({
    user, role, roleLoading: rolePending, loading, enabled, refreshRole, signUp, signIn, signInWithMagicLink, signInWithGoogle, resend, signOut,
  }), [user, role, rolePending, loading, refreshRole, signUp, signIn, signInWithMagicLink, signInWithGoogle, resend, signOut]);

  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
