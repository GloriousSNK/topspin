// Per-user session history + shareable coach summaries, stored in Supabase.
// Row-level security keeps each user's sessions private; shares are readable by
// anyone with the link.

import { supabase } from "./supabase";
import type { PoseAnalysis } from "./pose";
import type { Workout, GeneratedDrill } from "./types";

export interface SessionRow {
  id: string;
  created_at: string;
  stroke: string;
  form_score: number;
  serve_speed: number | null;
  flaws: PoseAnalysis["flaws"];
  joint_feedback: PoseAnalysis["jointFeedback"];
}

export async function saveSession(a: PoseAnalysis): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("sessions").insert({
    user_id: data.user.id,
    stroke: a.stroke,
    form_score: a.formScore,
    serve_speed: a.serveSpeedKmh ?? null,
    flaws: a.flaws,
    joint_feedback: a.jointFeedback,
  });
}

export async function getSessions(limit = 60): Promise<SessionRow[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("sessions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as SessionRow[]) ?? [];
}

export interface SharePayload {
  stroke: string;
  formScore: number;
  serveSpeedKmh?: number;
  flaws: PoseAnalysis["flaws"];
  jointFeedback: PoseAnalysis["jointFeedback"];
  workout?: Workout | null;
  createdAt: string;
}

function slug(): string {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
}

// Returns the share id (used to build /s/<id>), or null on failure.
export async function createShare(payload: SharePayload): Promise<string | null> {
  if (!supabase) return null;
  const id = slug();
  const { error } = await supabase.from("shares").insert({ id, payload });
  return error ? null : id;
}

export async function getShare(id: string): Promise<SharePayload | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("shares").select("payload").eq("id", id).single();
  return (data?.payload as SharePayload) ?? null;
}

// --- saved custom (AI-generated) drills ------------------------------------
export interface CustomDrillRow {
  id: string;
  created_at: string;
  drill: GeneratedDrill;
}

export async function saveCustomDrill(drill: GeneratedDrill): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;
  const { error } = await supabase.from("custom_drills").insert({ user_id: data.user.id, drill });
  return !error;
}

export async function saveWorkout(workout: Workout): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;
  const { error } = await supabase.from("custom_drills").insert({
    user_id: data.user.id, drill: { kind: "workout", ...workout },
  });
  return !error;
}

export async function getCustomDrills(limit = 30): Promise<CustomDrillRow[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("custom_drills")
    .select("id, created_at, drill")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as CustomDrillRow[]) ?? [];
}

// Row-level security already scopes writes to the owner (auth.uid() = user_id),
// so we delete by id alone and let RLS enforce ownership. `.select()` makes the
// call report success only when a row was actually removed — otherwise a policy
// that silently matches zero rows would look like a success and the item would
// reappear on the next load.
export async function deleteCustomDrill(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("custom_drills").delete().eq("id", id).select("id");
  return !error && Array.isArray(data) && data.length > 0;
}

// Rename a saved workout/drill by patching the title/name inside the jsonb.
export async function renameCustomDrill(id: string, title: string): Promise<boolean> {
  if (!supabase) return false;
  const { data: existing } = await supabase
    .from("custom_drills").select("drill").eq("id", id).maybeSingle();
  if (!existing) return false;
  const drill = existing.drill as Record<string, unknown>;
  const next = drill.kind === "workout" ? { ...drill, title } : { ...drill, name: title };
  const { data, error } = await supabase
    .from("custom_drills").update({ drill: next }).eq("id", id).select("id");
  return !error && Array.isArray(data) && data.length > 0;
}

// --- public profiles (share your progress) ---------------------------------
export interface Profile {
  user_id: string;
  is_public: boolean;
  display_name: string | null;
  utr: string | null;
  usta: string | null;
}

export async function getMyProfile(): Promise<Profile | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: p } = await supabase.from("profiles").select("*").eq("user_id", data.user.id).maybeSingle();
  return (p as Profile) ?? null;
}

export async function setMyProfile(
  isPublic: boolean, displayName: string, utr = "", usta = "",
): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;
  const { error } = await supabase.from("profiles").upsert({
    user_id: data.user.id,
    is_public: isPublic,
    display_name: displayName || null,
    utr: utr || null,
    usta: usta || null,
  });
  return !error;
}

// Public read of another player's profile + sessions (RLS gates by is_public).
export async function getPublicProfile(userId: string): Promise<{ profile: Profile | null; sessions: SessionRow[] }> {
  if (!supabase) return { profile: null, sessions: [] };
  const { data: p } = await supabase
    .from("profiles").select("*").eq("user_id", userId).eq("is_public", true).maybeSingle();
  if (!p) return { profile: null, sessions: [] };
  const { data: s } = await supabase
    .from("sessions").select("*").eq("user_id", userId)
    .order("created_at", { ascending: false }).limit(200);
  return { profile: p as Profile, sessions: (s as SessionRow[]) ?? [] };
}
