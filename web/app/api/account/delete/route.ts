import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertTrustedMutation, RequestSecurityError } from "@/lib/requestSecurity";

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const user = await getServerUser();
    if (!user) return NextResponse.json({ error: "Sign in again before deleting your account." }, { status: 401 });
    if (!supabaseAdmin) return NextResponse.json({ error: "Account deletion is not configured." }, { status: 503 });
    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (error) return NextResponse.json({ error: "Account deletion failed." }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Account deletion failed." }, { status: 500 });
  }
}
