// Async access to the shared Supabase browser client. The data helpers
// (history/coach/students/consent/accountGuard) call this instead of importing
// ./supabase at the top level, so the ~240KB SDK stays out of first-load JS on
// every app route and is fetched once, on first use (AuthProvider usually has
// it loaded already). Same singleton either way.

import type { SupabaseClient } from "@supabase/supabase-js";

let client: Promise<SupabaseClient | null> | null = null;

export function getSupabase(): Promise<SupabaseClient | null> {
  if (!client) {
    client = import("./supabase").then((m) => m.supabase);
    client.catch(() => { client = null; }); // a failed chunk load can be retried
  }
  return client;
}
