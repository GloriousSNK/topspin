import { describe, expect, it } from "vitest";
import { safeAuthRedirectPath } from "./authRedirect";

describe("safeAuthRedirectPath", () => {
  it("allows local application paths", () => {
    expect(safeAuthRedirectPath("/stats")).toBe("/stats");
  });

  it.each([null, "", "https://evil.example", "//evil.example"])(
    "rejects external or missing redirect %s",
    (value) => expect(safeAuthRedirectPath(value)).toBe("/account"),
  );

  it.each(["/\\evil.example", "/\\\\evil.example", "/%5c%5cevil.example", "/ok\nLocation: evil"])(
    "rejects parser-confusing redirect %s",
    (value) => expect(safeAuthRedirectPath(value)).toBe("/account"),
  );

  it("preserves a safe local query and fragment", () => {
    expect(safeAuthRedirectPath("/stats?range=30#trend")).toBe("/stats?range=30#trend");
  });
});
