import type { NextRequest } from "next/server";
import { refreshSupabaseSession } from "@/lib/supabaseProxy";

export async function proxy(request: NextRequest) {
  return refreshSupabaseSession(request);
}

export const config = {
  matcher: [
    "/account/:path*",
    "/stats/:path*",
    "/analyze/:path*",
    "/batch/:path*",
    "/coach/:path*",
    "/workouts/:path*",
    "/api/consent/:path*",
    "/api/account/:path*",
    "/auth/:path*",
    "/consent/:path*",
  ],
};
