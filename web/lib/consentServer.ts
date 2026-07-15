// Server-side consent helpers shared by the /api/consent/* route handlers.
// SERVER-ONLY (imports the service-role client). Never import from client code.

import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { generateConsentToken, hashConsentToken } from "./consent";
import { sendGuardianConsentEmail } from "./email";
import { SITE_URL } from "./site";
import { buildConsentApprovalUrl } from "./consentLink";

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

  const { data: issued, error } = await supabaseAdmin.rpc("issue_consent_token", {
    p_user_id: userId, p_token_hash: tokenHash, p_expires_at: expiresAt,
  });
  if (error || issued !== true) return false;

  const approveUrl = buildConsentApprovalUrl(SITE_URL, raw);
  return sendGuardianConsentEmail(guardianEmail, approveUrl);
}

// Redeem a guardian token: verify it's unused and unexpired, flip the account to
// 'approved', and burn the token. Returns true on success. All checks run under
// the service role; RLS never exposed these rows to the guardian's anonymous
// request. Guards against replay (used_at) and expiry.
export async function approveWithToken(rawToken: string): Promise<boolean> {
  if (!supabaseAdmin) return false;

  const tokenHash = await hashConsentToken(rawToken);
  const { data, error } = await supabaseAdmin.rpc("redeem_consent_token", { p_token_hash: tokenHash });
  return !error && data === true;
}
