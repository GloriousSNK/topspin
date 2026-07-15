import { describe, expect, it } from "vitest";
import { practiceDayStreak } from "./coachLogic";

describe("practiceDayStreak", () => {
  const now = new Date("2026-07-15T18:00:00Z");
  it("counts consecutive practice days ending today", () => {
    expect(practiceDayStreak(["2026-07-15T10:00:00Z", "2026-07-14T23:00:00Z", "2026-07-13T12:00:00Z"], now)).toBe(3);
  });
  it("allows the streak to end yesterday", () => {
    expect(practiceDayStreak(["2026-07-14T10:00:00Z", "2026-07-13T10:00:00Z"], now)).toBe(2);
  });
  it("does not count duplicate sessions twice", () => {
    expect(practiceDayStreak(["2026-07-15T10:00:00Z", "2026-07-15T11:00:00Z"], now)).toBe(1);
  });
  it("returns zero for empty or stale history", () => {
    expect(practiceDayStreak([], now)).toBe(0);
    expect(practiceDayStreak(["2026-07-10T10:00:00Z"], now)).toBe(0);
  });
});
