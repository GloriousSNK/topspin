// Outbound email for the guardian-consent flow. SERVER-ONLY.
//
// Deliberately provider-light: if RESEND_API_KEY is set we send via Resend's
// HTTP API (no SDK/dependency added); otherwise we log the link server-side so
// the flow is fully testable in local/dev without an email provider.
//
// SECURITY: the approval link is NEVER returned to the API caller — only ever
// emailed to, or logged for, the guardian. If we handed it back in the HTTP
// response, a minor could read their own guardian's link and self-approve,
// which is exactly the gate we're enforcing (threat-model T6).

import "server-only";

const FROM = process.env.CONSENT_EMAIL_FROM ?? "TopSpin <onboarding@resend.dev>";

export async function sendGuardianConsentEmail(to: string, approveUrl: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    // Dev fallback: no provider configured. Log so the flow can be exercised
    // locally. This only appears in the server console, never to the client.
    console.info(`[consent] Guardian approval link for ${to}: ${approveUrl}`);
    return true;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to,
        subject: "A young player needs your OK to connect with their coach on TopSpin",
        text:
          "Someone under your care created a TopSpin account and wants to share their practice " +
          "progress with their tennis coach.\n\n" +
          "Only a summary syncs (scores, drills done, dates) — no video, and no full breakdown. " +
          "They can use the rest of the app with no account at all.\n\n" +
          `To approve, open this link (it expires in 7 days and works once):\n${approveUrl}\n\n` +
          "If you weren't expecting this, you can ignore this email and nothing will sync.",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
