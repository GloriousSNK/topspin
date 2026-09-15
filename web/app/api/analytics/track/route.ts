import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

const ML = process.env.NEXT_PUBLIC_ML_URL ?? "https://tennis-ml.onrender.com";
const COUNTRY = /^[A-Z]{2}$/;

// Secret salt for the uniqueness hash. Set ANALYTICS_SALT in the environment;
// the fallback still works but a private value makes the hash unguessable.
const SALT = process.env.ANALYTICS_SALT ?? "topspin-analytics-v1";

// Crawlers, scrapers, link-preview fetchers and scripted clients. We drop these
// so they never inflate pageviews, country coverage, or "engaged athletes".
const BOT_RE =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora|pinterest|vkshare|w3c_validator|headless|phantom|puppeteer|playwright|python-requests|python-urllib|curl|wget|libwww|axios|node-fetch|go-http|okhttp|java\/|apache-httpclient|scrapy|semrush|ahrefs|dotbot|mj12|dataforseo|gptbot|ccbot|claudebot|bytespider|amazonbot|petalbot|yandex|baiduspider|uptime|pingdom|monitor|lighthouse/i;

// The real visitor IP, from the standard proxy headers Vercel sets.
function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "";
}

// Uniqueness key derived SERVER-SIDE from IP + user-agent, so a client can't
// mint fake distinct "athletes" by sending random session ids — inflating the
// count now requires genuinely distinct network origins. We hash (never store
// the raw IP), keeping this anonymous and cookie-free. Coarser than a per-device
// id (people behind one NAT+browser collapse together), so it errs toward
// UNDER-counting — the honest direction when the number has to be defensible.
function uniquenessKey(ip: string, ua: string): string {
  return createHash("sha256").update(`${ip}|${ua}|${SALT}`).digest("base64url").slice(0, 40);
}

export async function POST(request: NextRequest) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 4096) return NextResponse.json({ detail: "Request too large." }, { status: 413 });

  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ detail: "Invalid request." }, { status: 400 }); }
  if (!input || typeof input !== "object") return NextResponse.json({ detail: "Invalid request." }, { status: 400 });

  const body = input as Record<string, unknown>;
  const path = typeof body.path === "string" ? body.path.slice(0, 256) : "";
  const clientSession = typeof body.session === "string" ? body.session.slice(0, 64) : "";
  const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 256) : null;
  if (!path || !clientSession) return NextResponse.json({ detail: "Missing tracking fields." }, { status: 400 });

  // Bot filter: drop crawlers and empty-UA scripted clients silently (204 so the
  // caller doesn't retry). They never reach the analytics store.
  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || BOT_RE.test(ua)) return new NextResponse(null, { status: 204 });

  // Replace the client-supplied session with a server-derived key when we have a
  // real IP (production). Fall back to the client id only in local dev where no
  // forwarding header is present, so the dev flow still works.
  const ip = clientIp(request);
  const session = ip ? uniquenessKey(ip, ua) : clientSession;

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
