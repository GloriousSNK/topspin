import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const ML = process.env.NEXT_PUBLIC_ML_URL ?? "https://tennis-ml.onrender.com";
const COUNTRY = /^[A-Z]{2}$/;

export async function POST(request: NextRequest) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 4096) return NextResponse.json({ detail: "Request too large." }, { status: 413 });

  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ detail: "Invalid request." }, { status: 400 }); }
  if (!input || typeof input !== "object") return NextResponse.json({ detail: "Invalid request." }, { status: 400 });

  const body = input as Record<string, unknown>;
  const path = typeof body.path === "string" ? body.path.slice(0, 256) : "";
  const session = typeof body.session === "string" ? body.session.slice(0, 64) : "";
  const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 256) : null;
  if (!path || !session) return NextResponse.json({ detail: "Missing tracking fields." }, { status: 400 });

  const country = request.headers.get("x-vercel-ip-country")?.toUpperCase() ?? "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (COUNTRY.test(country)) headers["x-country-code"] = country;

  try {
    const upstream = await fetch(`${ML}/analytics/track`, {
      method: "POST", headers, body: JSON.stringify({ path, session, referrer }), cache: "no-store",
    });
    if (!upstream.ok) return NextResponse.json({ ok: false }, { status: 502 });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
