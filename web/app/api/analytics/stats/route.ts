import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ML = process.env.NEXT_PUBLIC_ML_URL ?? "https://tennis-ml.onrender.com";

// Total registered accounts, via a SECURITY DEFINER RPC (supabase-account-count.sql).
// Best-effort: if Supabase isn't configured or the function isn't installed yet,
// we fall back to 0 so the endpoint still returns usage numbers.
async function accountCount(): Promise<number> {
  if (!supabaseAdmin) return 0;
  try {
    const { data, error } = await supabaseAdmin.rpc("account_count");
    if (error) return 0;
    const n = Number(data);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  try {
    const [upstream, accounts] = await Promise.all([
      fetch(`${ML}/analytics/stats`, { cache: "no-store" }),
      accountCount(),
    ]);
    if (!upstream.ok) return NextResponse.json({ detail: "Stats unavailable." }, { status: 502 });
    const data = await upstream.json();

    // "Athletes served" = accounts made + unique sessions that actually used a
    // tool. The backend supplies active_athletes; we add the account count here
    // (accounts live in Supabase, usage lives in the analytics service).
    const active = Number(data.active_athletes ?? data.athletes_served ?? 0) || 0;
    const merged = { ...data, athletes_served: active + accounts };

    return NextResponse.json(merged, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ detail: "Stats unavailable." }, { status: 503 });
  }
}
