"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Session, User, SupabaseClient } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  loading: boolean;
  enabled: boolean;
  signUp: (email: string, password: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
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
    if (!enabled) { setLoading(false); return; }
    let alive = true;
    let unsub = () => {};
    loadClient().then((sb) => {
      if (!alive) return;
      clientRef.current = sb;
      if (!sb) { setLoading(false); return; }
      sb.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
        if (!alive) return;
        setUser(data.session?.user ?? null);
        setLoading(false);
      });
      const { data: sub } = sb.auth.onAuthStateChange((_e, s) => { if (alive) setUser(s?.user ?? null); });
      unsub = () => sub.subscription.unsubscribe();
    });
    return () => { alive = false; unsub(); };
  }, []);

  const origin = () => (typeof window !== "undefined" ? window.location.origin : "");
  const client = async () => clientRef.current ?? (await loadClient());

  const signUp = async (email: string, password: string) => {
    const sb = await client();
    if (!sb) return notConfigured;
    const { error } = await sb.auth.signUp({
      email, password, options: { emailRedirectTo: `${origin()}/account` },
    });
    return error ? friendly(error.message) : null;
  };
  const signIn = async (email: string, password: string) => {
    const sb = await client();
    if (!sb) return notConfigured;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return error ? friendly(error.message) : null;
  };
  const signInWithGoogle = async () => {
    const sb = await client();
    if (!sb) return;
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin()}/account` },
    });
  };
  const resend = async (email: string) => {
    const sb = await client();
    if (!sb) return notConfigured;
    const { error } = await sb.auth.resend({ type: "signup", email });
    return error ? friendly(error.message) : null;
  };
  const signOut = async () => { const sb = await client(); await sb?.auth.signOut(); };

  return (
    <Ctx.Provider value={{ user, loading, enabled, signUp, signIn, signInWithGoogle, resend, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
