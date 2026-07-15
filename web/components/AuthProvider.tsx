"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { User, SupabaseClient } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  loading: boolean;
  enabled: boolean;
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
// shared bundle — marketing pages don't pay for it up front, and it's only
// fetched (once, memoised) after hydration when auth is actually enabled.
let clientPromise: Promise<SupabaseClient | null> | null = null;
function loadClient(): Promise<SupabaseClient | null> {
  if (!enabled) return Promise.resolve(null);
  if (!clientPromise) clientPromise = import("@/lib/supabase").then((m) => m.supabase);
  return clientPromise;
}

const Ctx = createContext<AuthState>({
  user: null, loading: true, enabled: false,
  signUp: async () => notConfigured,
  signIn: async () => notConfigured,
  signInWithMagicLink: async () => notConfigured,
  signInWithGoogle: async () => {},
  resend: async () => notConfigured,
  signOut: async () => {},
});

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
  const [loading, setLoading] = useState(enabled);
  const clientRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- env config is external state
    if (!enabled) { setLoading(false); return; }
    // Remove retired localStorage token copies from the pre-SSR auth client.
    for (const key of Object.keys(window.localStorage)) {
      if (/^sb-.*-auth-token(?:\.|$)/.test(key)) window.localStorage.removeItem(key);
    }
    let alive = true;
    let unsub = () => {};
    loadClient().then((sb) => {
      if (!alive) return;
      clientRef.current = sb;
      if (!sb) { setLoading(false); return; }
      sb.auth.getUser().then(({ data }) => {
        if (!alive) return;
        setUser(data.user ?? null);
        setLoading(false);
      });
      const { data: sub } = sb.auth.onAuthStateChange((_e, s) => { if (alive) setUser(s?.user ?? null); });
      unsub = () => sub.subscription.unsubscribe();
    });
    return () => { alive = false; unsub(); };
  }, []);

  const origin = () => (typeof window !== "undefined" ? window.location.origin : "");
  const callback = () => `${origin()}/auth/callback?next=/account`;
  const client = async () => clientRef.current ?? (await loadClient());

  const signUp = async (email: string, password: string) => {
    const sb = await client();
    if (!sb) return notConfigured;
    const { error } = await sb.auth.signUp({
      email, password, options: { emailRedirectTo: callback() },
    });
    return error ? friendly(error.message) : null;
  };
  const signIn = async (email: string, password: string) => {
    const sb = await client();
    if (!sb) return notConfigured;
    setUser(null);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      const { data } = await sb.auth.getUser();
      setUser(data.user ?? null);
    }
    return error ? friendly(error.message) : null;
  };
  const signInWithMagicLink = async (email: string) => {
    const sb = await client();
    if (!sb) return notConfigured;
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback() },
    });
    return error ? friendly(error.message) : null;
  };
  const signInWithGoogle = async () => {
    const sb = await client();
    if (!sb) return;
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback() },
    });
  };
  const resend = async (email: string) => {
    const sb = await client();
    if (!sb) return notConfigured;
    const { error } = await sb.auth.resend({
      type: "signup", email, options: { emailRedirectTo: callback() },
    });
    return error ? friendly(error.message) : null;
  };
  const signOut = async () => {
    const sb = await client();
    const { error } = await sb?.auth.signOut() ?? { error: null };
    if (!error) setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, enabled, signUp, signIn, signInWithMagicLink, signInWithGoogle, resend, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
