import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), from: vi.fn(), rpc: vi.fn() }));

vi.mock("./supabase", () => ({
  supabase: { auth: { getSession: mocks.getSession }, from: mocks.from, rpc: mocks.rpc },
}));

import { addStudent, refile, updateStudentAnalysis } from "./students";
import { ME, studentSubject } from "./studentsLogic";

const signedIn = (id: string) => ({ data: { session: { user: { id } } }, error: null });

describe("student folder writes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses to create a folder when the active account changed", async () => {
    mocks.getSession.mockResolvedValue(signedIn("account-b"));
    await expect(addStudent("account-a", "John")).resolves.toEqual({ ok: false, error: "session" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("creates the folder under the coach's own id with a cleaned name", async () => {
    mocks.getSession.mockResolvedValue(signedIn("coach-1"));
    const single = vi.fn().mockResolvedValue({ data: { id: "s1", name: "John", note: null, created_at: "x" }, error: null });
    const insert = vi.fn().mockReturnValue({ select: () => ({ single }) });
    mocks.from.mockReturnValue({ insert });
    await expect(addStudent("coach-1", "  John  ")).resolves.toMatchObject({ ok: true, data: { id: "s1" } });
    expect(insert).toHaveBeenCalledWith({ coach_id: "coach-1", name: "John" });
  });

  it("reports a missing migration as a setup problem", async () => {
    mocks.getSession.mockResolvedValue(signedIn("coach-1"));
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST205" } });
    mocks.from.mockReturnValue({ insert: () => ({ select: () => ({ single }) }) });
    await expect(addStudent("coach-1", "John")).resolves.toEqual({ ok: false, error: "setup" });
  });

  it("scopes analysis updates to the coach and only reports success for one row", async () => {
    mocks.getSession.mockResolvedValue(signedIn("coach-1"));
    const select = vi.fn().mockResolvedValue({ data: [], error: null });
    const eqCoach = vi.fn().mockReturnValue({ select });
    const eqId = vi.fn().mockReturnValue({ eq: eqCoach });
    const update = vi.fn().mockReturnValue({ eq: eqId });
    mocks.from.mockReturnValue({ update });
    await expect(updateStudentAnalysis("coach-1", "a1", { starred: true })).resolves.toBe(false);
    expect(update).toHaveBeenCalledWith({ starred: true });
    expect(eqCoach).toHaveBeenCalledWith("coach_id", "coach-1");
  });
});

describe("refile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue(signedIn("coach-1"));
  });

  it("moves an analysis from the coach's history into a folder atomically", async () => {
    mocks.rpc.mockResolvedValue({ data: "new-id", error: null });
    await expect(refile("coach-1", { subject: ME, id: "sess-1" }, studentSubject("s1")))
      .resolves.toEqual({ subject: "student:s1", id: "new-id" });
    expect(mocks.rpc).toHaveBeenCalledWith("move_session_to_student", { p_session_id: "sess-1", p_student_id: "s1" });
  });

  it("moves an analysis back to the coach's own history", async () => {
    mocks.rpc.mockResolvedValue({ data: "sess-2", error: null });
    await expect(refile("coach-1", { subject: studentSubject("s1"), id: "a1" }, ME))
      .resolves.toEqual({ subject: ME, id: "sess-2" });
    expect(mocks.rpc).toHaveBeenCalledWith("move_student_analysis_to_me", { p_analysis_id: "a1" });
  });

  it("returns null when the move is rejected", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(refile("coach-1", { subject: ME, id: "sess-1" }, studentSubject("s1"))).resolves.toBeNull();
  });

  it("is a no-op when the destination is unchanged", async () => {
    const filed = { subject: studentSubject("s1"), id: "a1" };
    await expect(refile("coach-1", filed, studentSubject("s1"))).resolves.toBe(filed);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
