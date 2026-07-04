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
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({
  user: null, loading: true, enabled: false,
  signUp: async () => "Accounts are not configured.",
  signIn: async () => "Accounts are not configured.",
  signOut: async () => {},
});

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

  const signUp = async (email: string, password: string) => {
    if (!supabase) return "Accounts are not configured.";
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? error.message : null;
  };
  const signIn = async (email: string, password: string) => {
    if (!supabase) return "Accounts are not configured.";
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  };
  const signOut = async () => { await supabase?.auth.signOut(); };

  return (
    <Ctx.Provider value={{ user, loading, enabled: authEnabled, signUp, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
