import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock("./supabase", () => ({ supabase: { auth: { getUser: mocks.getUser }, rpc: mocks.rpc, from: mocks.from } }));

import { chooseRole, getCoachRoster, leaveSquad } from "./coach";

describe("coach data account isolation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not call a role mutation for a different active account", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "account-b" } }, error: null });
    await expect(chooseRole("account-a", "coach")).resolves.toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("discards a roster response when the account changes in flight", async () => {
    mocks.getUser
      .mockResolvedValueOnce({ data: { user: { id: "coach-a" } }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: "coach-b" } }, error: null });
    mocks.rpc.mockResolvedValue({ data: [{ player_id: "player" }], error: null });
    await expect(getCoachRoster("coach-a")).resolves.toEqual([]);
  });

  it("does not report squad departure after the session changes", async () => {
    mocks.getUser
      .mockResolvedValueOnce({ data: { user: { id: "player-a" } }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: "player-b" } }, error: null });
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await expect(leaveSquad("player-a")).resolves.toBe(false);
  });
});
