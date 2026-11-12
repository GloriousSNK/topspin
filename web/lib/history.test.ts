import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PoseAnalysis } from "./pose";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
  from: vi.fn(),
}));

vi.mock("./supabase", () => ({
  supabase: {
    auth: { getSession: mocks.getSession, getUser: mocks.getUser },
    from: mocks.from,
  },
}));

import { getSessions, saveSession } from "./history";

const analysis = {
  stroke: "forehand",
  formScore: 80,
  flaws: [],
  jointFeedback: [],
} as unknown as PoseAnalysis;

describe("account-scoped history writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.insert.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: "session-1" }, error: null }) }),
    });
  });

  it("refuses a write when the active account changed", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "account-b" } } }, error: null });

    await saveSession(analysis, "account-a");

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("writes only to the account captured when the action started", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "account-a" } } }, error: null });

    await expect(saveSession(analysis, "account-a")).resolves.toBe("session-1");

    expect(mocks.from).toHaveBeenCalledWith("sessions");
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "account-a" }));
  });

  it("discards a private read when the account changes before it returns", async () => {
    mocks.getSession
      .mockResolvedValueOnce({ data: { session: { user: { id: "account-a" } } }, error: null })
      .mockResolvedValueOnce({ data: { session: { user: { id: "account-b" } } }, error: null });
    const limit = vi.fn().mockResolvedValue({ data: [{ id: "from-account-a" }] });
    const order = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    mocks.from.mockReturnValue({ select });

    await expect(getSessions("account-a")).resolves.toEqual([]);
  });

  it("returns the owner-filtered rows without a network identity round trip", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "account-a" } } }, error: null });
    const limit = vi.fn().mockResolvedValue({ data: [{ id: "row-1" }] });
    const order = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    mocks.from.mockReturnValue({ select });

    await expect(getSessions("account-a")).resolves.toEqual([{ id: "row-1" }]);
    expect(eq).toHaveBeenCalledWith("user_id", "account-a");
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("refuses a write when nobody is signed in", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await expect(saveSession(analysis, "account-a")).resolves.toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
