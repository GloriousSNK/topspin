// POST /api/consent/init — record a new account's declared age and, for minors,
// kick off the guardian-consent request.
//
// The account's consent STATUS is derived here on the server from the declared
// birth year — the client cannot set it directly (threat-model T5/T6). Adults
// become 'not_required' (may sync immediately); minors become 'pending' and a
// guardian approval email goes out. Everything is done with the service role
// after verifying the caller's own access token.

import { NextResponse } from "next/server";
import { supabaseAdmin, userIdFromBearer } from "@/lib/supabaseAdmin";
import { consentStatusForBirthYear, isPlausibleBirthYear } from "@/lib/consent";
import { issueGuardianToken } from "@/lib/consentServer";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Accounts are not configured." }, { status: 503 });
  }
  if (!rateLimit(`init:${clientIp(req)}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const userId = await userIdFromBearer(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { birthYear?: unknown; guardianEmail?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const birthYear = Number(body.birthYear);
  if (!isPlausibleBirthYear(birthYear)) {
    return NextResponse.json({ error: "Enter a valid birth year." }, { status: 400 });
  }

  const status = consentStatusForBirthYear(birthYear);
  const guardianEmailRaw = typeof body.guardianEmail === "string" ? body.guardianEmail.trim() : "";
  const guardianEmail = guardianEmailRaw.toLowerCase();

  if (status === "pending") {
    if (!EMAIL_RE.test(guardianEmail)) {
      return NextResponse.json(
        { error: "A parent or guardian's email is needed to finish setting up this account." },
        { status: 400 },
      );
    }
  }

  // Upsert the consent row. We never write 'approved' here — only the guardian
  // approval route can do that.
  const { error } = await supabaseAdmin.from("account_consent").upsert(
    {
      user_id: userId,
      birth_year: birthYear,
      guardian_email: status === "pending" ? guardianEmail : null,
      consent_status: status,
    },
    { onConflict: "user_id" },
  );
  if (error) return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });

  if (status === "pending") {
    // Fire the guardian request. Even if the email dispatch fails, the account
    // is correctly 'pending' and the player can re-send from their account page.
    await issueGuardianToken(userId, guardianEmail);
  }

  return NextResponse.json({ status });
}
