// Server-side consent helpers shared by the /api/consent/* route handlers.
// SERVER-ONLY (imports the service-role client). Never import from client code.

import { supabaseAdmin } from "./supabaseAdmin";
import { generateConsentToken, hashConsentToken } from "./consent";
import { sendGuardianConsentEmail } from "./email";
import { SITE_URL } from "./site";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Issue a fresh single-use guardian token, invalidating any prior unused ones,
// stamp requested_at, and email the guardian the approval link. Returns whether
// the email was dispatched. The raw token never leaves this function except in
// the outbound email — it is not returned to any HTTP caller.
export async function issueGuardianToken(userId: string, guardianEmail: string): Promise<boolean> {
  if (!supabaseAdmin) return false;

  const raw = generateConsentToken();
  const tokenHash = await hashConsentToken(raw);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  // One live token at a time: drop any earlier unused ones for this user so a
  // stale link can't be used after a re-send.
  await supabaseAdmin.from("consent_tokens").delete().eq("user_id", userId).is("used_at", null);

  const { error } = await supabaseAdmin
    .from("consent_tokens")
    .insert({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt });
  if (error) return false;

  await supabaseAdmin
    .from("account_consent")
    .update({ requested_at: new Date().toISOString() })
    .eq("user_id", userId);

  const approveUrl = `${SITE_URL}/consent/${raw}`;
  return sendGuardianConsentEmail(guardianEmail, approveUrl);
}

// Redeem a guardian token: verify it's unused and unexpired, flip the account to
// 'approved', and burn the token. Returns true on success. All checks run under
// the service role; RLS never exposed these rows to the guardian's anonymous
// request. Guards against replay (used_at) and expiry.
export async function approveWithToken(rawToken: string): Promise<boolean> {
  if (!supabaseAdmin) return false;

  const tokenHash = await hashConsentToken(rawToken);
  const { data: tok } = await supabaseAdmin
    .from("consent_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!tok || tok.used_at || new Date(tok.expires_at).getTime() < Date.now()) return false;

  // Burn the token first (single-use): mark used and only for a still-unused row
  // so two concurrent redemptions can't both win.
  const { data: burned } = await supabaseAdmin
    .from("consent_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tok.id)
    .is("used_at", null)
    .select("id");
  if (!burned || burned.length === 0) return false;

  const { error } = await supabaseAdmin
    .from("account_consent")
    .update({ consent_status: "approved", approved_at: new Date().toISOString() })
    .eq("user_id", tok.user_id);
  return !error;
}
