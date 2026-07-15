// Consent + age-gate logic for the coach layer (Phase 1b).
//
// The account-free app is untouched by any of this — consent only ever matters
// once someone makes an account and wants to sync/join a squad. See
// docs/coach-layer-threat-model.md and supabase-coach-layer.sql.
//
// This module splits cleanly into PURE logic (age decision, token hashing,
// code normalisation — unit-tested, runnable anywhere with Web Crypto) and thin
// CLIENT callers that talk to the /api/consent/* route handlers.

import { supabase } from "./supabase";

// --- Age policy -------------------------------------------------------------
// COPPA draws the US line at 13; GDPR-covered regions can be as high as 16. We
// take the SAFER line (16) as the single gate, which also covers under-13s, and
// we only ever store a birth YEAR (coarse, lower-data) — never a full DOB.
export const COPPA_AGE = 13;
export const CONSENT_AGE = 16; // protective default line for "needs a guardian"

export type ConsentStatus = "not_required" | "pending" | "approved";

// A person born in `birthYear` is between (year - birthYear - 1) and
// (year - birthYear) years old right now. We decide protectively: if it's
// *possible* they're under CONSENT_AGE, they need a guardian. That means their
// oldest-possible age this year must clear the line with a full year to spare.
export function needsGuardianConsent(birthYear: number, now: Date = new Date()): boolean {
  const ageUpperBound = now.getFullYear() - birthYear;
  return ageUpperBound <= CONSENT_AGE;
}

// The status a freshly-created account should get from a declared birth year.
// Adults are 'not_required' (may sync immediately); minors are 'pending' until
// a guardian approves. This is derived SERVER-SIDE so a client can't hand us a
// status directly.
export function consentStatusForBirthYear(birthYear: number, now: Date = new Date()): ConsentStatus {
  return needsGuardianConsent(birthYear, now) ? "pending" : "not_required";
}

// Reject nonsense before it reaches the DB. Allows 5-year-olds (they'll just be
// gated) up to the current year, and no absurd historical years.
export function isPlausibleBirthYear(birthYear: number, now: Date = new Date()): boolean {
  const y = now.getFullYear();
  return Number.isInteger(birthYear) && birthYear >= y - 120 && birthYear <= y;
}

// --- Guardian tokens (T6): opaque, single-use, only the hash is stored -------
// The raw token travels only in the guardian's email link; the DB keeps its
// SHA-256 so a table leak can't be replayed. Uses Web Crypto, available in both
// the Next.js server runtime and Node's test runner.
export function generateConsentToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

export async function hashConsentToken(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return hex(new Uint8Array(digest));
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// --- Squad codes ------------------------------------------------------------
// Codes are matched case-insensitively; join_squad() upper-cases server-side,
// and we mirror that here so the UI compares/echoes a canonical form.
export function normalizeSquadCode(code: string): string {
  return code.trim().toUpperCase();
}

// --- Client callers ---------------------------------------------------------
// Each POSTs to a route handler. The server verifies the cookie-backed session
// before performing any service-role write.
async function authedPost(path: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Accounts are not configured." };
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      return { ok: false, error: msg || `Request failed (${res.status}).` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't reach the server. Check your connection." };
  }
}

export interface ConsentRow {
  user_id: string;
  birth_year: number | null;
  guardian_email: string | null;
  consent_status: ConsentStatus;
  requested_at: string | null;
  approved_at: string | null;
}

// Reads the caller's own consent row (RLS already scopes this to the owner).
export async function getMyConsent(expectedUserId: string): Promise<ConsentRow | null> {
  if (!supabase) return null;
  const { data: u } = await supabase.auth.getUser();
  if (u.user?.id !== expectedUserId) return null;
  const { data, error } = await supabase
    .from("account_consent")
    .select("user_id, birth_year, guardian_email, consent_status, requested_at, approved_at")
    .eq("user_id", expectedUserId)
    .maybeSingle();
  if (error) throw error;
  const { data: current } = await supabase.auth.getUser();
  if (current.user?.id !== expectedUserId) return null;
  return (data as ConsentRow) ?? null;
}

// Records the declared birth year (and guardian email for minors). The server
// derives and writes the status; a minor also gets a guardian request sent.
export function submitAgeGate(birthYear: number, guardianEmail?: string) {
  return authedPost("/api/consent/init", { birthYear, guardianEmail: guardianEmail ?? null });
}

// Re-send the guardian a fresh consent link (e.g. the first one expired).
export function resendGuardianRequest() {
  return authedPost("/api/consent/request", {});
}
