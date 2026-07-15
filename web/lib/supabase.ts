// Cookie-backed Supabase browser client. The singleton is shared by auth and
// RLS-protected data helpers so session refreshes stay in sync across the app.

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anon ? createBrowserClient(url, anon) : null;

export const authEnabled = !!supabase;
