"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, authEnabled } from "@/lib/supabase";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const origin = () => (typeof window !== "undefined" ? window.location.origin : "");

  const signUp = async (email: string, password: string) => {
    if (!supabase) return notConfigured;
    const { error } = await supabase.auth.signUp({
      email, password, options: { emailRedirectTo: `${origin()}/account` },
    });
    return error ? friendly(error.message) : null;
  };
  const signIn = async (email: string, password: string) => {
    if (!supabase) return notConfigured;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? friendly(error.message) : null;
  };
  const signInWithGoogle = async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin()}/account` },
    });
  };
  const resend = async (email: string) => {
    if (!supabase) return notConfigured;
    const { error } = await supabase.auth.resend({ type: "signup", email });
    return error ? friendly(error.message) : null;
  };
  const signOut = async () => { await supabase?.auth.signOut(); };

  return (
    <Ctx.Provider value={{ user, loading, enabled: authEnabled, signUp, signIn, signInWithGoogle, resend, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
