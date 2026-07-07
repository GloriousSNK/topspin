// SERVER-ONLY Supabase client using the service-role key.
//
// DO NOT import this from any "use client" file or anything that ends up in the
// browser bundle — the service-role key bypasses RLS and must never leave the
// server. It's only referenced by the /api/consent/* route handlers.
//
// The key lives in a NON-public env var (SUPABASE_SERVICE_ROLE_KEY), so it is
// never inlined into client code the way NEXT_PUBLIC_* vars are. If it's unset,
// this is null and the consent routes fail closed (503), matching the rest of
// the app's "degrade gracefully when accounts aren't configured" behaviour.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin: SupabaseClient | null =
  url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

// Verify a caller's access token (from the Authorization: Bearer header) and
// return their user id, or null if the token is missing/invalid/expired. This
// is how a service-role route re-establishes "who is asking" before writing.
export async function userIdFromBearer(authHeader: string | null): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
