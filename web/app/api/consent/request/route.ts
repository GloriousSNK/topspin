// POST /api/consent/request — re-send the guardian a fresh consent link.
//
// Used when the first email didn't arrive or the link expired. Only valid while
// the account is still 'pending' and has a guardian email on file. Rate-limited
// harder than init to blunt using it as an email-spam relay.

import { NextResponse } from "next/server";
import { supabaseAdmin, userIdFromBearer } from "@/lib/supabaseAdmin";
import { issueGuardianToken } from "@/lib/consentServer";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Accounts are not configured." }, { status: 503 });
  }

  const userId = await userIdFromBearer(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

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

  await issueGuardianToken(userId, row.guardian_email);
  return NextResponse.json({ ok: true });
}
