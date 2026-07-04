// Supabase browser client. Auth + per-user data live here.
// Configured via env; if the keys aren't set, `supabase` is null and all
// account features degrade gracefully (the app still works signed-out).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anon ? createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

export const authEnabled = !!supabase;
