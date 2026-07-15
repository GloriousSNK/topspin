// POST /api/consent/init — record a new account's declared age and, for minors,
// kick off the guardian-consent request.
//
// The account's consent STATUS is derived here on the server from the declared
// birth year — the client cannot set it directly (threat-model T5/T6). Adults
// become 'not_required' (may sync immediately); minors become 'pending' and a
// guardian approval email goes out. Everything is done with the service role
// after verifying the caller's own access token.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerUser } from "@/lib/supabaseServer";
import { consentStatusForBirthYear, isPlausibleBirthYear } from "@/lib/consent";
import { issueGuardianToken } from "@/lib/consentServer";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { assertTrustedMutation, readBoundedJson, RequestSecurityError } from "@/lib/requestSecurity";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try { assertTrustedMutation(req); } catch (error) {
    const e = error as RequestSecurityError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 403 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Accounts are not configured." }, { status: 503 });
  }
  if (!rateLimit(`init:${clientIp(req)}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const userId = user.id;

  let body: { birthYear?: unknown; guardianEmail?: unknown };
  try {
    body = await readBoundedJson(req);
  } catch (error) {
    const e = error as RequestSecurityError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 400 });
  }

  const birthYear = Number(body.birthYear);
  if (!isPlausibleBirthYear(birthYear)) {
    return NextResponse.json({ error: "Enter a valid birth year." }, { status: 400 });
  }

  const requestedStatus = consentStatusForBirthYear(birthYear);
  const guardianEmailRaw = typeof body.guardianEmail === "string" ? body.guardianEmail.trim() : "";
  const guardianEmail = guardianEmailRaw.toLowerCase();

  if (requestedStatus === "pending") {
    if (!EMAIL_RE.test(guardianEmail)) {
      return NextResponse.json(
        { error: "A parent or guardian's email is needed to finish setting up this account." },
        { status: 400 },
      );
    }
    // A minor can't be their own guardian: reject the account's own email so the
    // approval link can't be self-received and self-approved.
    if (user.email && guardianEmail === user.email.trim().toLowerCase()) {
      return NextResponse.json(
        { error: "The guardian's email must be different from your own." },
        { status: 400 },
      );
    }
  }

  const { data, error } = await supabaseAdmin.rpc("initialize_account_consent", {
    p_user_id: userId,
    p_birth_year: birthYear,
    p_guardian_email: requestedStatus === "pending" ? guardianEmail : null,
  });
  if (error || typeof data !== "string") {
    return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });
  }
  const status = data;

  if (status === "pending" && requestedStatus === "pending") {
    const sent = await issueGuardianToken(userId, guardianEmail);
    if (!sent) {
      return NextResponse.json(
        { error: "Your age was saved, but the approval email could not be sent. Try resend shortly." },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ status });
}
