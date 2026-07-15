// POST /api/consent/request — re-send the guardian a fresh consent link.
//
// Used when the first email didn't arrive or the link expired. Only valid while
// the account is still 'pending' and has a guardian email on file. Rate-limited
// harder than init to blunt using it as an email-spam relay.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerUser } from "@/lib/supabaseServer";
import { issueGuardianToken } from "@/lib/consentServer";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { assertTrustedMutation, RequestSecurityError } from "@/lib/requestSecurity";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try { assertTrustedMutation(req); } catch (error) {
    const e = error as RequestSecurityError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 403 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Accounts are not configured." }, { status: 503 });
  }

  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const userId = user.id;

  // Per-user AND per-IP caps: a handful of re-sends an hour is plenty.
  if (
    !rateLimit(`request:user:${userId}`, 5, 60 * 60 * 1000) ||
    !rateLimit(`request:ip:${clientIp(req)}`, 20, 60 * 60 * 1000)
  ) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const { data: row } = await supabaseAdmin
    .from("account_consent")
    .select("consent_status, guardian_email")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row || row.consent_status !== "pending" || !row.guardian_email) {
    return NextResponse.json({ error: "No guardian approval is pending on this account." }, { status: 409 });
  }

  const sent = await issueGuardianToken(userId, row.guardian_email);
  if (!sent) return NextResponse.json({ error: "The approval email could not be sent. Try again shortly." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
