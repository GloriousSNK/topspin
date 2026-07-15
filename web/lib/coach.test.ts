import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock("./supabase", () => ({ supabase: { auth: { getUser: mocks.getUser }, rpc: mocks.rpc, from: mocks.from } }));

import { chooseRole, createSquad, getCoachRoster, leaveSquad } from "./coach";

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

  it("identifies a stale squad database function", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "coach-a" } }, error: null });
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "42883", message: "function gen_random_bytes(integer) does not exist" },
    });
    await expect(createSquad("coach-a", "Varsity")).resolves.toEqual({ squad: null, error: "setup" });
  });

  it("returns a newly created squad", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "coach-a" } }, error: null });
    mocks.rpc.mockResolvedValue({
      data: [{ squad_id: "squad-1", squad_name: "Varsity", squad_code: "A1B2C3" }],
      error: null,
    });
    await expect(createSquad("coach-a", "Varsity")).resolves.toEqual({
      squad: { id: "squad-1", name: "Varsity", code: "A1B2C3" },
      error: null,
    });
  });
});
