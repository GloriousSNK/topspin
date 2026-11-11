import { describe, expect, it } from "vitest";
import {
  analysisTitle, cleanName, sortAnalyses, sortFolders, studentSubject, subjectStudentId, summarizeFolders, ME,
} from "./studentsLogic";

const students = [
  { id: "a", name: "anna", note: null, created_at: "2026-11-01T10:00:00Z" },
  { id: "b", name: "Ben", note: null, created_at: "2026-11-02T10:00:00Z" },
  { id: "c", name: "Cleo", note: null, created_at: "2026-11-03T10:00:00Z" },
];
const analyses = [
  { student_id: "a", created_at: "2026-11-05T10:00:00Z", form_score: 70, starred: true },
  { student_id: "a", created_at: "2026-11-09T10:00:00Z", form_score: 82, starred: false },
  { student_id: "b", created_at: "2026-11-07T10:00:00Z", form_score: null, starred: false },
  { student_id: "b", created_at: "2026-11-06T10:00:00Z", form_score: 64, starred: true },
  { student_id: "b", created_at: "2026-11-04T10:00:00Z", form_score: 60, starred: false },
];

describe("summarizeFolders", () => {
  const folders = summarizeFolders(students, analyses);
  it("counts analyses and stars per folder", () => {
    expect(folders.map((f) => [f.id, f.analyses, f.starred])).toEqual([["a", 2, 1], ["b", 3, 1], ["c", 0, 0]]);
  });
  it("uses the newest scored analysis as the latest score", () => {
    expect(folders.find((f) => f.id === "a")?.latest_score).toBe(82);
    expect(folders.find((f) => f.id === "b")?.latest_score).toBe(64);
    expect(folders.find((f) => f.id === "c")?.latest_score).toBeNull();
  });
  it("tracks the most recent activity", () => {
    expect(folders.find((f) => f.id === "b")?.last_active).toBe("2026-11-07T10:00:00Z");
    expect(folders.find((f) => f.id === "c")?.last_active).toBeNull();
  });
});

describe("sortFolders", () => {
  const folders = summarizeFolders(students, analyses);
  it("sorts by recent activity, empty folders last", () => {
    expect(sortFolders(folders, "recent").map((f) => f.id)).toEqual(["a", "b", "c"]);
  });
  it("sorts by name, ignoring case", () => {
    expect(sortFolders(folders, "name").map((f) => f.name)).toEqual(["anna", "Ben", "Cleo"]);
  });
  it("sorts by analysis count", () => {
    expect(sortFolders(folders, "count").map((f) => f.id)).toEqual(["b", "a", "c"]);
  });
});

describe("sortAnalyses", () => {
  const rows = [
    { id: "1", created_at: "2026-11-01T00:00:00Z", form_score: 70 },
    { id: "2", created_at: "2026-11-03T00:00:00Z", form_score: null },
    { id: "3", created_at: "2026-11-02T00:00:00Z", form_score: 90 },
  ];
  it("orders by date both ways", () => {
    expect(sortAnalyses(rows, "newest").map((r) => r.id)).toEqual(["2", "3", "1"]);
    expect(sortAnalyses(rows, "oldest").map((r) => r.id)).toEqual(["1", "3", "2"]);
  });
  it("puts unscored rows last when sorting by score", () => {
    expect(sortAnalyses(rows, "best").map((r) => r.id)).toEqual(["3", "1", "2"]);
    expect(sortAnalyses(rows, "worst").map((r) => r.id)).toEqual(["1", "3", "2"]);
  });
  it("does not mutate the input", () => {
    sortAnalyses(rows, "best");
    expect(rows.map((r) => r.id)).toEqual(["1", "2", "3"]);
  });
});

describe("subjects and names", () => {
  it("round-trips a student subject", () => {
    expect(subjectStudentId(studentSubject("abc"))).toBe("abc");
    expect(subjectStudentId(ME)).toBeNull();
  });
  it("cleans folder names", () => {
    expect(cleanName("  John   Smith ")).toBe("John Smith");
    expect(cleanName("x".repeat(80))).toHaveLength(60);
    expect(cleanName("   ")).toBe("");
  });
  it("falls back to stroke and date for an untitled analysis", () => {
    expect(analysisTitle({ title: "  Lesson 3 ", stroke: "serve", created_at: "2026-11-01T12:00:00Z" })).toBe("Lesson 3");
    expect(analysisTitle({ title: null, stroke: "serve", created_at: "2026-11-01T12:00:00Z" })).toMatch(/^Serve · /);
  });
});
