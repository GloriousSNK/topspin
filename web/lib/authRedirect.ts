export function safeAuthRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/account";
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return "/account";
  try {
    const decoded = decodeURIComponent(value);
    if (/[\\\u0000-\u001f\u007f]/.test(decoded)) return "/account";
    const base = new URL("https://topspin.invalid");
    const parsed = new URL(value, base);
    if (parsed.origin !== base.origin) return "/account";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/account";
  }
}
