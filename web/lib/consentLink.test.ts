import { describe, expect, it } from "vitest";
import { buildConsentApprovalUrl } from "./consentLink";

describe("guardian approval links", () => {
  it("keeps the raw token out of the requested URL path", () => {
    const raw = "secret_token-123";
    const url = new URL(buildConsentApprovalUrl("https://topspin.example", raw));
    expect(url.pathname).toBe("/consent");
    expect(url.pathname).not.toContain(raw);
    expect(new URLSearchParams(url.hash.slice(1)).get("token")).toBe(raw);
  });
});
