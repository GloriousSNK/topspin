import { supabase } from "./supabase";
import type { SharePayload } from "./history";

export type AccountRole = "player" | "coach";

export interface SquadSummary {
  id: string;
  name: string;
  code: string;
}

export interface MembershipSummary {
  squad_id: string;
  squad_name: string;
  coach_name: string;
}

export interface CoachContext {
  role: AccountRole | null;
  squads: SquadSummary[];
  membership: MembershipSummary | null;
}

export interface RosterPlayer {
  player_id: string;
  squad_id: string;
  squad_name: string;
  display_name: string;
  latest_score: number | null;
  last_active: string | null;
  trend: "new" | "improving" | "steady" | "declining";
}

export interface PlayerSummaryRow {
  id: string;
  created_at: string;
  stroke: string | null;
  form_score: number | null;
  drills_completed: number;
}

export interface PracticeCompletion {
  id: string;
  title: string;
  drills_completed: number;
  completed_at: string;
}

export interface CoachPlayerHistory {
  player_id: string;
  display_name: string;
  summaries: PlayerSummaryRow[];
}

export interface CoachAnalysisShare {
  id: string;
  player_id: string;
  payload: SharePayload;
  coach_note: string | null;
  created_at: string;
  noted_at: string | null;
}

async function matches(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.auth.getUser();
  return !error && data.user?.id === userId;
}

export async function getCoachContext(userId: string): Promise<CoachContext | null> {
  if (!supabase || !(await matches(userId))) return null;
  const { data, error } = await supabase.rpc("get_my_coach_context");
  if (error || !(await matches(userId))) return null;
  const value = data as Partial<CoachContext> | null;
  return {
    role: value?.role ?? null,
    squads: Array.isArray(value?.squads) ? value.squads : [],
    membership: value?.membership ?? null,
  };
}

export async function chooseRole(userId: string, role: AccountRole): Promise<AccountRole | null> {
  if (!supabase || !(await matches(userId))) return null;
  const { data, error } = await supabase.rpc("choose_account_role", { p_role: role });
  return error || !(await matches(userId)) ? null : data as AccountRole;
}

export async function createSquad(userId: string, name: string): Promise<SquadSummary | null> {
  if (!supabase || !(await matches(userId))) return null;
  const { data, error } = await supabase.rpc("create_my_squad", { p_name: name });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row || !(await matches(userId))) return null;
  return { id: row.squad_id, name: row.squad_name, code: row.squad_code };
}

export async function joinSquad(userId: string, code: string): Promise<MembershipSummary | null> {
  if (!supabase || !(await matches(userId))) return null;
  const { data, error } = await supabase.rpc("join_squad", { p_code: code });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row || !(await matches(userId))) return null;
  return { squad_id: row.squad_id, squad_name: row.squad_name, coach_name: "Your coach" };
}

export async function leaveSquad(userId: string): Promise<boolean> {
  if (!supabase || !(await matches(userId))) return false;
  const { error } = await supabase.rpc("leave_squad");
  return !error && await matches(userId);
}

export async function syncPlayerSummary(
  userId: string,
  stroke: string,
  formScore: number | null,
  drillsCompleted = 0,
): Promise<boolean> {
  if (!supabase || !(await matches(userId))) return false;
  const { data, error } = await supabase.rpc("sync_player_summary", {
    p_stroke: stroke,
    p_form_score: formScore,
    p_drills_completed: drillsCompleted,
  });
  return !error && data !== null && await matches(userId);
}

export async function completePractice(userId: string, title: string, drillsCompleted: number): Promise<boolean> {
  if (!supabase || !(await matches(userId))) return false;
  const { data, error } = await supabase.rpc("complete_practice", { p_title: title, p_drills_completed: drillsCompleted });
  return !error && !!data && await matches(userId);
}

export async function getPracticeCompletions(userId: string): Promise<PracticeCompletion[]> {
  if (!supabase || !(await matches(userId))) return [];
  const { data, error } = await supabase.from("practice_completions")
    .select("id, title, drills_completed, completed_at").eq("user_id", userId)
    .order("completed_at", { ascending: false }).limit(100);
  return error || !(await matches(userId)) ? [] : (data as PracticeCompletion[]) ?? [];
}

export async function getCoachRoster(userId: string): Promise<RosterPlayer[]> {
  if (!supabase || !(await matches(userId))) return [];
  const { data, error } = await supabase.rpc("get_coach_roster");
  return error || !(await matches(userId)) || !Array.isArray(data) ? [] : data as RosterPlayer[];
}

export async function getCoachPlayerHistory(userId: string, playerId: string): Promise<CoachPlayerHistory | null> {
  if (!supabase || !(await matches(userId))) return null;
  const { data, error } = await supabase.rpc("get_coach_player_history", { p_player_id: playerId });
  return error || !data || !(await matches(userId)) ? null : data as CoachPlayerHistory;
}

export async function shareAnalysisWithCoach(userId: string, payload: SharePayload): Promise<boolean> {
  if (!supabase || !(await matches(userId))) return false;
  const { data, error } = await supabase.rpc("share_analysis_with_coach", { p_payload: payload });
  return !error && !!data && await matches(userId);
}

export async function getSharedAnalyses(userId: string, playerId: string): Promise<CoachAnalysisShare[]> {
  if (!supabase || !(await matches(userId))) return [];
  const { data, error } = await supabase.from("coach_analysis_shares")
    .select("id, player_id, payload, coach_note, created_at, noted_at")
    .eq("player_id", playerId).order("created_at", { ascending: false }).limit(30);
  return error || !(await matches(userId)) ? [] : (data as CoachAnalysisShare[]) ?? [];
}

export async function saveCoachNote(userId: string, shareId: string, note: string): Promise<boolean> {
  if (!supabase || !(await matches(userId))) return false;
  const { data, error } = await supabase.from("coach_analysis_shares")
    .update({ coach_note: note.trim() || null, noted_at: new Date().toISOString() })
    .eq("id", shareId).select("id");
  return !error && Array.isArray(data) && data.length === 1 && await matches(userId);
}

function publicId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface ParentReportPayload {
  playerName: string;
  coachName: string;
  createdAt: string;
  summaries: PlayerSummaryRow[];
  note?: string;
}

export async function createParentReport(
  userId: string,
  playerId: string,
  payload: ParentReportPayload,
): Promise<string | null> {
  if (!supabase || !(await matches(userId))) return null;
  const id = publicId();
  const { data, error } = await supabase.rpc("create_parent_report", {
    p_id: id,
    p_player_id: playerId,
    p_payload: payload,
  });
  return error || data !== true || !(await matches(userId)) ? null : id;
}

export async function getParentReport(id: string): Promise<ParentReportPayload | null> {
  if (!supabase || !/^[A-Za-z0-9_-]{24,64}$/.test(id)) return null;
  const { data, error } = await supabase.rpc("get_parent_report", { p_id: id });
  return error ? null : data as ParentReportPayload | null;
}
