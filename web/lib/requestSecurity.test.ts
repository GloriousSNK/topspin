import { describe, expect, it } from "vitest";
import { assertTrustedMutation, readBoundedJson, RequestSecurityError } from "./requestSecurity";

describe("request security", () => {
  it("accepts a same-origin JSON mutation", () => {
    const request = new Request("https://topspin-labs.vercel.app/api/test", {
      method: "POST", headers: { origin: "https://topspin-labs.vercel.app", "sec-fetch-site": "same-origin" },
    });
    expect(() => assertTrustedMutation(request)).not.toThrow();
  });

  it.each(["https://evil.example", "https://sub.topspin-labs.vercel.app"])(
    "rejects origin %s",
    (origin) => {
      const request = new Request("https://topspin-labs.vercel.app/api/test", { method: "POST", headers: { origin } });
      expect(() => assertTrustedMutation(request)).toThrow(RequestSecurityError);
    },
  );

  it("rejects a missing origin", () => {
    expect(() => assertTrustedMutation(new Request("https://topspin-labs.vercel.app/api/test", { method: "POST" })))
      .toThrow(RequestSecurityError);
  });

  it("rejects streamed JSON beyond the limit", async () => {
    const request = new Request("https://topspin-labs.vercel.app/api/test", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ value: "x".repeat(50) }),
    });
    await expect(readBoundedJson(request, 16)).rejects.toMatchObject({ status: 413 });
  });
});
