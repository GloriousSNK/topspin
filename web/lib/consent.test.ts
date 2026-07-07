import { describe, it, expect } from "vitest";
import {
  needsGuardianConsent,
  consentStatusForBirthYear,
  isPlausibleBirthYear,
  normalizeSquadCode,
  hashConsentToken,
  generateConsentToken,
  CONSENT_AGE,
} from "./consent";

// Pin "now" so the age-boundary tests don't drift year to year.
const NOW = new Date("2026-07-07T00:00:00Z");

describe("age gate", () => {
  it("treats the 16-and-under boundary protectively", () => {
    // ageUpperBound = 2026 - birthYear; minor when that is <= CONSENT_AGE (16).
    expect(needsGuardianConsent(2010, NOW)).toBe(true); // could be 15 → minor
    expect(needsGuardianConsent(2009, NOW)).toBe(false); // at least 16 → cleared
    expect(needsGuardianConsent(2015, NOW)).toBe(true); // ~11 → minor
    expect(needsGuardianConsent(1990, NOW)).toBe(false); // adult
  });

  it("maps birth year to the right starting status", () => {
    expect(consentStatusForBirthYear(2015, NOW)).toBe("pending");
    expect(consentStatusForBirthYear(2000, NOW)).toBe("not_required");
    // A child exactly on the line still needs consent (never auto-clears).
    expect(consentStatusForBirthYear(NOW.getFullYear() - CONSENT_AGE, NOW)).toBe("pending");
  });

  it("rejects implausible birth years", () => {
    expect(isPlausibleBirthYear(2026, NOW)).toBe(true);
    expect(isPlausibleBirthYear(2027, NOW)).toBe(false); // future
    expect(isPlausibleBirthYear(1905, NOW)).toBe(false); // >120 years ago
    expect(isPlausibleBirthYear(2010.5, NOW)).toBe(false); // non-integer
    expect(isPlausibleBirthYear(NaN, NOW)).toBe(false);
  });
});

describe("squad codes", () => {
  it("canonicalises to trimmed upper-case", () => {
    expect(normalizeSquadCode("  ab3dxy ")).toBe("AB3DXY");
    expect(normalizeSquadCode("ABCDEF")).toBe("ABCDEF");
  });
});

describe("consent tokens", () => {
  it("hashes deterministically to 64 hex chars", async () => {
    const h1 = await hashConsentToken("hello-token");
    const h2 = await hashConsentToken("hello-token");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes different inputs differently", async () => {
    const a = await hashConsentToken("token-a");
    const b = await hashConsentToken("token-b");
    expect(a).not.toBe(b);
  });

  it("generates unique url-safe tokens", () => {
    const a = generateConsentToken();
    const b = generateConsentToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/); // no +, /, or = padding
  });
});
