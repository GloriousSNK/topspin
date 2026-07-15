import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const revalidate = 15;

const ML = process.env.NEXT_PUBLIC_ML_URL ?? "https://tennis-ml.onrender.com";

export async function GET() {
  try {
    const upstream = await fetch(`${ML}/analytics/stats`, { next: { revalidate: 15 } });
    if (!upstream.ok) return NextResponse.json({ detail: "Stats unavailable." }, { status: 502 });
    const data = await upstream.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json({ detail: "Stats unavailable." }, { status: 503 });
  }
}
