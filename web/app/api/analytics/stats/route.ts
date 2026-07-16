import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ML = process.env.NEXT_PUBLIC_ML_URL ?? "https://tennis-ml.onrender.com";

export async function GET() {
  try {
    const upstream = await fetch(`${ML}/analytics/stats`, { cache: "no-store" });
    if (!upstream.ok) return NextResponse.json({ detail: "Stats unavailable." }, { status: 502 });
    const data = await upstream.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ detail: "Stats unavailable." }, { status: 503 });
  }
}
