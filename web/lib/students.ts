// Coach-managed student folders, stored in Supabase (supabase-coach-students.sql).
//
// A coach analyses clips of students who don't have accounts and files each one
// under that student's folder instead of the coach's own history. Rows are owned
// by the coach (RLS: coach_id = auth.uid()); every query also filters by the
// coach id explicitly and re-checks the signed-in account after it returns, the
// same as lib/history.ts, so an account switch mid-request can't leak rows.

import { getSupabase } from "./supabaseLazy";
import { isSignedInAs } from "./accountGuard";
import type { PoseAnalysis } from "./pose";
import {
  cleanName, summarizeFolders, subjectStudentId, studentSubject, ME,
  type StudentAnalysisRow, type StudentFolder, type StudentRow, type Subject,
} from "./studentsLogic";

// Local (no network) "still the same account?" check — see lib/accountGuard.ts.
const matches = isSignedInAs;

export type StudentsResult<T> = { ok: true; data: T } | { ok: false; error: "session" | "setup" | "failed" };

function failure(error: { code?: string; message?: string } | null): { ok: false; error: "setup" | "failed" } {
  const code = error?.code ?? "";
  // 42P01 undefined table, PGRST205 table not in schema cache, PGRST202 missing function
  return { ok: false, error: code === "42P01" || code === "PGRST205" || code === "PGRST202" ? "setup" : "failed" };
}

const ANALYSIS_COLUMNS =
  "id, student_id, created_at, title, stroke, form_score, serve_speed, flaws, joint_feedback, skeleton, starred, note";

export async function listStudentFolders(userId: string): Promise<StudentsResult<StudentFolder[]>> {
  const supabase = await getSupabase();
  if (!supabase || !(await matches(userId))) return { ok: false, error: "session" };
  const [students, stats] = await Promise.all([
    supabase.from("coach_students").select("id, name, note, created_at").eq("coach_id", userId).limit(500),
    supabase.from("coach_student_analyses").select("student_id, created_at, form_score, starred")
      .eq("coach_id", userId).order("created_at", { ascending: false }).limit(5000),
  ]);
  if (!(await matches(userId))) return { ok: false, error: "session" };
  if (students.error) return failure(students.error);
  if (stats.error) return failure(stats.error);
  return { ok: true, data: summarizeFolders((students.data as StudentRow[]) ?? [], stats.data ?? []) };
}

export async function getStudentFolder(
  userId: string, studentId: string,
): Promise<StudentsResult<{ student: StudentRow; analyses: StudentAnalysisRow[] } | null>> {
  const supabase = await getSupabase();
  if (!supabase || !(await matches(userId))) return { ok: false, error: "session" };
  const [student, analyses] = await Promise.all([
    supabase.from("coach_students").select("id, name, note, created_at")
      .eq("coach_id", userId).eq("id", studentId).maybeSingle(),
    supabase.from("coach_student_analyses").select(ANALYSIS_COLUMNS)
      .eq("coach_id", userId).eq("student_id", studentId).order("created_at", { ascending: false }).limit(1000),
  ]);
  if (!(await matches(userId))) return { ok: false, error: "session" };
  if (student.error) return failure(student.error);
  if (analyses.error) return failure(analyses.error);
  if (!student.data) return { ok: true, data: null };
  return { ok: true, data: { student: student.data as StudentRow, analyses: (analyses.data as StudentAnalysisRow[]) ?? [] } };
}

export async function addStudent(userId: string, rawName: string): Promise<StudentsResult<StudentRow>> {
  const supabase = await getSupabase();
  const name = cleanName(rawName);
  if (!name) return { ok: false, error: "failed" };
  if (!supabase || !(await matches(userId))) return { ok: false, error: "session" };
  const { data, error } = await supabase.from("coach_students")
    .insert({ coach_id: userId, name }).select("id, name, note, created_at").single();
  if (!(await matches(userId))) return { ok: false, error: "session" };
  return error || !data ? failure(error) : { ok: true, data: data as StudentRow };
}

async function updateOne(
  table: "coach_students" | "coach_student_analyses", userId: string, id: string, patch: Record<string, unknown>,
): Promise<boolean> {
  const supabase = await getSupabase();
  if (!supabase || !(await matches(userId))) return false;
  const { data, error } = await supabase.from(table).update(patch).eq("id", id).eq("coach_id", userId).select("id");
  return !error && Array.isArray(data) && data.length === 1 && await matches(userId);
}

async function deleteOne(table: "coach_students" | "coach_student_analyses", userId: string, id: string): Promise<boolean> {
  const supabase = await getSupabase();
  if (!supabase || !(await matches(userId))) return false;
  const { data, error } = await supabase.from(table).delete().eq("id", id).eq("coach_id", userId).select("id");
  return !error && Array.isArray(data) && data.length === 1 && await matches(userId);
}

export function renameStudent(userId: string, studentId: string, rawName: string): Promise<boolean> {
  const name = cleanName(rawName);
  return name ? updateOne("coach_students", userId, studentId, { name }) : Promise.resolve(false);
}

export function setStudentNote(userId: string, studentId: string, note: string): Promise<boolean> {
  return updateOne("coach_students", userId, studentId, { note: note.trim().slice(0, 2000) || null });
}

// Deleting a folder also deletes every analysis in it (FK cascade).
export function deleteStudent(userId: string, studentId: string): Promise<boolean> {
  return deleteOne("coach_students", userId, studentId);
}

export interface AnalysisPatch {
  title?: string | null;
  note?: string | null;
  starred?: boolean;
  student_id?: string;
}

export function updateStudentAnalysis(userId: string, analysisId: string, patch: AnalysisPatch): Promise<boolean> {
  const clean: Record<string, unknown> = {};
  if (patch.title !== undefined) clean.title = patch.title?.replace(/\s+/g, " ").trim().slice(0, 80) || null;
  if (patch.note !== undefined) clean.note = patch.note?.trim().slice(0, 2000) || null;
  if (patch.starred !== undefined) clean.starred = patch.starred;
  if (patch.student_id !== undefined) clean.student_id = patch.student_id;
  if (!Object.keys(clean).length) return Promise.resolve(false);
  return updateOne("coach_student_analyses", userId, analysisId, clean);
}

export function deleteStudentAnalysis(userId: string, analysisId: string): Promise<boolean> {
  return deleteOne("coach_student_analyses", userId, analysisId);
}

// Returns the new analysis id, or null.
export async function saveStudentAnalysis(userId: string, studentId: string, a: PoseAnalysis): Promise<string | null> {
  const supabase = await getSupabase();
  if (!supabase || !(await matches(userId))) return null;
  const { data, error } = await supabase.from("coach_student_analyses").insert({
    coach_id: userId,
    student_id: studentId,
    stroke: a.stroke,
    form_score: a.formScore,
    serve_speed: a.serveSpeedKmh ?? null,
    flaws: a.flaws,
    joint_feedback: a.jointFeedback,
    skeleton: a.skeleton,
  }).select("id").single();
  return error || !data || !(await matches(userId)) ? null : (data as { id: string }).id;
}

// --- re-filing --------------------------------------------------------------
// `Filed` says where a saved analysis currently lives and under which row id.
export type Filed = { subject: Subject; id: string };

export async function moveSessionToStudent(userId: string, sessionId: string, studentId: string): Promise<string | null> {
  const supabase = await getSupabase();
  if (!supabase || !(await matches(userId))) return null;
  const { data, error } = await supabase.rpc("move_session_to_student", { p_session_id: sessionId, p_student_id: studentId });
  return error || typeof data !== "string" || !(await matches(userId)) ? null : data;
}

export async function moveAnalysisToMe(userId: string, analysisId: string): Promise<string | null> {
  const supabase = await getSupabase();
  if (!supabase || !(await matches(userId))) return null;
  const { data, error } = await supabase.rpc("move_student_analysis_to_me", { p_analysis_id: analysisId });
  return error || typeof data !== "string" || !(await matches(userId)) ? null : data;
}

// Move a saved analysis to another subject. Returns its new location, or null.
export async function refile(userId: string, from: Filed, to: Subject): Promise<Filed | null> {
  if (from.subject === to) return from;
  const fromStudent = subjectStudentId(from.subject);
  const toStudent = subjectStudentId(to);
  if (!fromStudent && toStudent) {
    const id = await moveSessionToStudent(userId, from.id, toStudent);
    return id ? { subject: studentSubject(toStudent), id } : null;
  }
  if (fromStudent && !toStudent) {
    const id = await moveAnalysisToMe(userId, from.id);
    return id ? { subject: ME, id } : null;
  }
  if (fromStudent && toStudent) {
    return await updateStudentAnalysis(userId, from.id, { student_id: toStudent }) ? { subject: to, id: from.id } : null;
  }
  return null;
}

// --- remembered picker choice (per account, per browser) --------------------
const subjectKey = (userId: string) => `topspin:analysis-subject:${userId}`;

export function rememberSubject(userId: string, subject: Subject): void {
  try { window.localStorage.setItem(subjectKey(userId), subject); } catch { /* storage unavailable */ }
}

export function recallSubject(userId: string): Subject | null {
  try {
    const value = window.localStorage.getItem(subjectKey(userId));
    return value === ME || value?.startsWith("student:") ? value as Subject : null;
  } catch { return null; }
}
