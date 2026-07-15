import { SITE_URL } from "./site";

export class RequestSecurityError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function assertTrustedMutation(request: Request): void {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") throw new RequestSecurityError(403, "Cross-site request blocked.");

  const origin = request.headers.get("origin");
  if (!origin) throw new RequestSecurityError(403, "Missing request origin.");
  const requestOrigin = new URL(request.url).origin;
  const allowed = new Set([requestOrigin, new URL(SITE_URL).origin]);
  if (!allowed.has(origin)) throw new RequestSecurityError(403, "Untrusted request origin.");
}

export async function readBoundedJson<T>(request: Request, maxBytes = 8192): Promise<T> {
  const type = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (type !== "application/json") throw new RequestSecurityError(415, "Expected application/json.");

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new RequestSecurityError(413, "Request body is too large.");
  }

  const reader = request.body?.getReader();
  if (!reader) throw new RequestSecurityError(400, "Missing request body.");
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new RequestSecurityError(413, "Request body is too large.");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new RequestSecurityError(400, "Bad request.");
  }
}
