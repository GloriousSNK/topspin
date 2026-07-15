import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PoseAnalysis } from "./pose";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  insert: vi.fn(),
  from: vi.fn(),
}));

vi.mock("./supabase", () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
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
    mocks.insert.mockResolvedValue({ error: null });
  });

  it("refuses a write when the active account changed", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "account-b" } }, error: null });

    await saveSession(analysis, "account-a");

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("writes only to the account captured when the action started", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "account-a" } }, error: null });

    await saveSession(analysis, "account-a");

    expect(mocks.from).toHaveBeenCalledWith("sessions");
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "account-a" }));
  });

  it("discards a private read when the account changes before it returns", async () => {
    mocks.getUser
      .mockResolvedValueOnce({ data: { user: { id: "account-a" } }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: "account-b" } }, error: null });
    const limit = vi.fn().mockResolvedValue({ data: [{ id: "from-account-a" }] });
    const order = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    mocks.from.mockReturnValue({ select });

    await expect(getSessions("account-a")).resolves.toEqual([]);
  });
});
