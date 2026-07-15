export function buildConsentApprovalUrl(siteUrl: string, rawToken: string): string {
  const url = new URL("/consent", siteUrl);
  url.hash = new URLSearchParams({ token: rawToken }).toString();
  return url.toString();
}
