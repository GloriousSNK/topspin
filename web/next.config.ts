import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Derive the allowed ML/analytics origin from the SAME env var the client
// fetches, so the CSP allowlist and the fetch base can never drift apart.
const ML = process.env.NEXT_PUBLIC_ML_URL ?? "http://127.0.0.1:8000";
const ML_ORIGINS = `${ML} http://127.0.0.1:8000 http://localhost:8000`;

// Origins the in-browser pose model needs: WASM from jsDelivr, model from GCS.
const POSE_ORIGINS = "https://cdn.jsdelivr.net https://storage.googleapis.com";

// style-src keeps 'unsafe-inline' because the app uses inline style attributes
// pervasively (style injection is low-risk, ~defacement only).
// script-src: 'unsafe-eval' is dev/HMR-only and dropped in production;
// 'wasm-unsafe-eval' is required for the MediaPipe pose WASM runtime.
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.jsdelivr.net"
  : "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net";

const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  scriptSrc,
  "font-src 'self' data:",
  `connect-src 'self' ${ML_ORIGINS} ${POSE_ORIGINS}`,
  "worker-src 'self' blob:",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
