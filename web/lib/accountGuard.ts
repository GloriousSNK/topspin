// Client-side "is this still the same account?" check used around every
// account-scoped query in lib/history.ts, lib/coach.ts, lib/students.ts and
// lib/consent.ts.
//
// What it protects: a request started for account A must never write to, or
// display data for, account B if the browser switched accounts while it was in
// flight (sign-out/sign-in in another tab shares the same auth cookie). So each
// helper checks the active account before it queries and again after the
// response arrives, and drops the result if the account changed.
//
// Why getSession() rather than getUser(): getUser() is a network round trip to
// Supabase Auth, and doing it before AND after every query made a simple read
// three sequential round trips. getSession() reads the cookie-backed session
// locally — and that local session is exactly the identity whose access token
// supabase-js attaches to the query, so comparing against it is the precise
// guarantee we need ("the request runs, and its result lands, under the same
// account"). It is not an authorization check and never was: a forged or stale
// local session can't read or write anything, because the server re-verifies the
// JWT and row-level security scopes every row to auth.uid(). AuthProvider still
// validates the session with getUser() once on load.

import { getSupabase } from "./supabaseLazy";

export async function isSignedInAs(expectedUserId: string): Promise<boolean> {
  const supabase = await getSupabase();
  if (!supabase || !expectedUserId) return false;
  try {
    const { data, error } = await supabase.auth.getSession();
    return !error && data.session?.user?.id === expectedUserId;
  } catch {
    return false;
  }
}
