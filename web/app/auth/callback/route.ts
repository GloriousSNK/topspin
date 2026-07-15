import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { safeAuthRedirectPath } from "@/lib/authRedirect";
import { SITE_URL } from "@/lib/site";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeAuthRedirectPath(url.searchParams.get("next"));

  if (code) {
    const client = await createServerSupabase();
    const result = client
      ? await client.auth.exchangeCodeForSession(code)
      : { error: new Error("Accounts are not configured.") };
    if (!result.error) return NextResponse.redirect(new URL(next, SITE_URL));
  }

  const account = new URL("/account", url.origin);
  account.searchParams.set("authError", "This sign-in link is invalid or expired. Please try again.");
  return NextResponse.redirect(account);
}
