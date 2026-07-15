// POST /api/consent/approve — a guardian redeems their single-use token.
//
// This is the ONLY path that flips an account to 'approved'. It's unauthenticated
// (the guardian isn't a TopSpin user), so it's protected by the token itself
// (high-entropy, hashed at rest, single-use, expiring) plus per-IP rate limiting
// to slow brute-force guessing (threat-model T6).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { approveWithToken } from "@/lib/consentServer";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { assertTrustedMutation, readBoundedJson, RequestSecurityError } from "@/lib/requestSecurity";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try { assertTrustedMutation(req); } catch (error) {
    const e = error as RequestSecurityError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 403 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Accounts are not configured." }, { status: 503 });
  }
  // Tight cap: token space is astronomically large, so a legitimate guardian
  // needs one request; anything more from an IP is a guessing attempt.
  if (!rateLimit(`approve:${clientIp(req)}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let body: { token?: unknown };
  try {
    body = await readBoundedJson(req);
  } catch (error) {
    const e = error as RequestSecurityError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  // Real tokens are ~43 url-safe chars; reject anything absurd before hashing so
  // a giant body can't be used to burn CPU. A too-long value can't match anyway.
  if (!token || token.length > 200) {
    return NextResponse.json({ error: "Missing or malformed token." }, { status: 400 });
  }

  const ok = await approveWithToken(token);
  if (!ok) {
    return NextResponse.json(
      { error: "This approval link is invalid, already used, or expired." },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
