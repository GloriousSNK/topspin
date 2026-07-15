import type { PoseAnalysis } from "./pose";
import type { GeneratedDrill, Workout } from "./types";
import type { CustomDrillRow, SessionRow } from "./history";

const SESSION_KEY = "topspin:local-sessions:v1";
const DRILL_KEY = "topspin:local-drills:v1";
const PRACTICE_KEY = "topspin:local-practice:v1";
const MAX_ROWS = 100;

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try { const value = JSON.parse(window.localStorage.getItem(key) ?? "[]"); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
function write<T>(key: string, rows: T[]) { window.localStorage.setItem(key, JSON.stringify(rows.slice(0, MAX_ROWS))); }

export function saveLocalSession(a: PoseAnalysis): void {
  const row: SessionRow = { id: crypto.randomUUID(), created_at: new Date().toISOString(), stroke: a.stroke,
    form_score: a.formScore, serve_speed: a.serveSpeedKmh ?? null, flaws: a.flaws, joint_feedback: a.jointFeedback };
  write(SESSION_KEY, [row, ...read<SessionRow>(SESSION_KEY)]);
}
export function getLocalSessions(): SessionRow[] { return read<SessionRow>(SESSION_KEY); }
export function saveLocalDrill(drill: GeneratedDrill): CustomDrillRow {
  const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), drill };
  write(DRILL_KEY, [row, ...read<CustomDrillRow>(DRILL_KEY)]); return row;
}
export function saveLocalWorkout(workout: Workout): CustomDrillRow {
  return saveLocalDrill({ kind: "workout", ...workout } as unknown as GeneratedDrill);
}
export function getLocalDrills(): CustomDrillRow[] { return read<CustomDrillRow>(DRILL_KEY); }
export function deleteLocalDrill(id: string): boolean { write(DRILL_KEY, read<CustomDrillRow>(DRILL_KEY).filter((x) => x.id !== id)); return true; }
export function renameLocalDrill(id: string, title: string): boolean {
  const rows = read<CustomDrillRow>(DRILL_KEY).map((row) => {
    if (row.id !== id) return row;
    const drill = row.drill as unknown as Record<string, unknown>;
    return { ...row, drill: (drill.kind === "workout" ? { ...drill, title } : { ...drill, name: title }) as unknown as GeneratedDrill };
  });
  write(DRILL_KEY, rows); return true;
}

export interface LocalPracticeCompletion { id: string; title: string; drills_completed: number; completed_at: string }
export function completeLocalPractice(title: string, drillsCompleted: number): LocalPracticeCompletion {
  const row = { id: crypto.randomUUID(), title, drills_completed: drillsCompleted, completed_at: new Date().toISOString() };
  write(PRACTICE_KEY, [row, ...read<LocalPracticeCompletion>(PRACTICE_KEY)]); return row;
}
export function getLocalPracticeCompletions(): LocalPracticeCompletion[] { return read<LocalPracticeCompletion>(PRACTICE_KEY); }
