// Pure helpers for coach-managed student folders (no I/O, unit-tested).

export interface StudentRow {
  id: string;
  name: string;
  note: string | null;
  created_at: string;
}

export interface StudentAnalysisRow {
  id: string;
  student_id: string;
  created_at: string;
  title: string | null;
  stroke: string | null;
  form_score: number | null;
  serve_speed: number | null;
  flaws: { id: string; label: string; severity: number; coaching_cue: string }[] | null;
  joint_feedback: { joint: string; reading: string; status: "good" | "minor" | "off"; note: string }[] | null;
  skeleton: Record<string, [number, number]> | null;
  starred: boolean;
  note: string | null;
}

export interface StudentFolder extends StudentRow {
  analyses: number;
  latest_score: number | null;
  last_active: string | null;
  starred: number;
}

export type FolderSort = "recent" | "name" | "count";
export type AnalysisSort = "newest" | "oldest" | "best" | "worst";

// Where an analysis is filed: the coach's own history, or a student folder.
export type Subject = "me" | `student:${string}`;
export const ME: Subject = "me";
export const studentSubject = (id: string): Subject => `student:${id}`;
export function subjectStudentId(subject: Subject): string | null {
  return subject.startsWith("student:") ? subject.slice("student:".length) || null : null;
}

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 60);
}

type FolderStat = Pick<StudentAnalysisRow, "student_id" | "created_at" | "form_score" | "starred">;

export function summarizeFolders(students: StudentRow[], analyses: FolderStat[]): StudentFolder[] {
  const byStudent = new Map<string, FolderStat[]>();
  for (const a of analyses) {
    const list = byStudent.get(a.student_id) ?? [];
    list.push(a);
    byStudent.set(a.student_id, list);
  }
  return students.map((s) => {
    const rows = (byStudent.get(s.id) ?? []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
    const scored = rows.find((r) => typeof r.form_score === "number");
    return {
      ...s,
      analyses: rows.length,
      latest_score: scored?.form_score ?? null,
      last_active: rows[0]?.created_at ?? null,
      starred: rows.filter((r) => r.starred).length,
    };
  });
}

export function sortFolders(folders: StudentFolder[], mode: FolderSort): StudentFolder[] {
  const byName = (a: StudentFolder, b: StudentFolder) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  return folders.slice().sort((a, b) => {
    if (mode === "name") return byName(a, b);
    if (mode === "count") return b.analyses - a.analyses || byName(a, b);
    // recent: latest activity first; empty folders by creation date after them
    const ka = a.last_active ?? "", kb = b.last_active ?? "";
    if (ka !== kb) return kb.localeCompare(ka);
    return b.created_at.localeCompare(a.created_at) || byName(a, b);
  });
}

export function sortAnalyses<T extends Pick<StudentAnalysisRow, "created_at" | "form_score">>(rows: T[], mode: AnalysisSort): T[] {
  const score = (r: T, missing: number) => (typeof r.form_score === "number" ? r.form_score : missing);
  return rows.slice().sort((a, b) => {
    switch (mode) {
      case "oldest": return a.created_at.localeCompare(b.created_at);
      case "best": return score(b, -1) - score(a, -1) || b.created_at.localeCompare(a.created_at);
      case "worst": return score(a, 101) - score(b, 101) || b.created_at.localeCompare(a.created_at);
      default: return b.created_at.localeCompare(a.created_at);
    }
  });
}

export function analysisTitle(row: Pick<StudentAnalysisRow, "title" | "stroke" | "created_at">): string {
  if (row.title?.trim()) return row.title.trim();
  const stroke = row.stroke ? row.stroke.charAt(0).toUpperCase() + row.stroke.slice(1) : "Analysis";
  return `${stroke} · ${new Date(row.created_at).toLocaleDateString()}`;
}
