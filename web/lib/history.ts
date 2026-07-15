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
  flaws?: PoseAnalysis["flaws"];
  joint_feedback?: PoseAnalysis["jointFeedback"];
}

async function userMatches(expectedUserId: string): Promise<boolean> {
  if (!supabase || !expectedUserId) return false;
  const { data, error } = await supabase.auth.getUser();
  return !error && data.user?.id === expectedUserId;
}

export async function saveSession(a: PoseAnalysis, expectedUserId: string): Promise<boolean> {
  if (!supabase) return false;
  if (!(await userMatches(expectedUserId))) return false;
  const { error } = await supabase.from("sessions").insert({
    user_id: expectedUserId,
    stroke: a.stroke,
    form_score: a.formScore,
    serve_speed: a.serveSpeedKmh ?? null,
    flaws: a.flaws,
    joint_feedback: a.jointFeedback,
  });
  return !error;
}

export async function deleteSessions(expectedUserId: string): Promise<boolean> {
  if (!supabase || !(await userMatches(expectedUserId))) return false;
  const { error } = await supabase.from("sessions").delete().eq("user_id", expectedUserId);
  return !error && await userMatches(expectedUserId);
}

// IMPORTANT: this MUST filter by the current user's id. The `sessions` table has
// a "public sessions read" RLS policy (so /u/<id> profiles work), which means an
// unfiltered `select("*")` returns your rows UNION every public user's rows —
// leaking other accounts' analyses into your private Stats/account views. RLS is
// the backstop for *authorization*; the query still has to scope to the owner.
export async function getSessions(expectedUserId: string, limit = 60): Promise<SessionRow[]> {
  if (!supabase) return [];
  if (!(await userMatches(expectedUserId))) return [];
  const { data } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", expectedUserId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!(await userMatches(expectedUserId))) return [];
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
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Returns the share id (used to build /s/<id>), or null on failure.
export async function createShare(payload: SharePayload, expectedUserId: string): Promise<string | null> {
  if (!supabase) return null;
  if (!(await userMatches(expectedUserId))) return null;
  const id = slug();
  const { error } = await supabase.from("shares").insert({ id, payload, user_id: expectedUserId });
  return error ? null : id;
}

export async function getShare(id: string): Promise<SharePayload | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_share_by_id", { p_id: id });
  return error ? null : (data as SharePayload) ?? null;
}

// --- saved custom (AI-generated) drills ------------------------------------
export interface CustomDrillRow {
  id: string;
  created_at: string;
  drill: GeneratedDrill;
}

export async function saveCustomDrill(drill: GeneratedDrill, expectedUserId: string): Promise<boolean> {
  if (!supabase) return false;
  if (!(await userMatches(expectedUserId))) return false;
  const { error } = await supabase.from("custom_drills").insert({ user_id: expectedUserId, drill });
  return !error;
}

export async function saveWorkout(workout: Workout, expectedUserId: string): Promise<boolean> {
  if (!supabase) return false;
  if (!(await userMatches(expectedUserId))) return false;
  const { error } = await supabase.from("custom_drills").insert({
    user_id: expectedUserId, drill: { kind: "workout", ...workout },
  });
  return !error;
}

export async function getCustomDrills(expectedUserId: string, limit = 30): Promise<CustomDrillRow[]> {
  if (!supabase) return [];
  // custom_drills has no public read policy today, so RLS already scopes this to
  // the owner — but we filter by user_id explicitly anyway, so a future public
  // policy (like the one on sessions) can never silently turn this into a leak.
  if (!(await userMatches(expectedUserId))) return [];
  const { data } = await supabase
    .from("custom_drills")
    .select("id, created_at, drill")
    .eq("user_id", expectedUserId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!(await userMatches(expectedUserId))) return [];
  return (data as CustomDrillRow[]) ?? [];
}

// Row-level security already scopes writes to the owner (auth.uid() = user_id),
// so we delete by id alone and let RLS enforce ownership. `.select()` makes the
// call report success only when a row was actually removed — otherwise a policy
// that silently matches zero rows would look like a success and the item would
// reappear on the next load.
export async function deleteCustomDrill(id: string, expectedUserId: string): Promise<boolean> {
  if (!supabase) return false;
  if (!(await userMatches(expectedUserId))) return false;
  const { data, error } = await supabase
    .from("custom_drills").delete().eq("id", id).eq("user_id", expectedUserId).select("id");
  return !error && Array.isArray(data) && data.length > 0;
}

// Rename a saved workout/drill by patching the title/name inside the jsonb.
export async function renameCustomDrill(id: string, title: string, expectedUserId: string): Promise<boolean> {
  if (!supabase) return false;
  if (!(await userMatches(expectedUserId))) return false;
  const { data: existing } = await supabase
    .from("custom_drills").select("drill").eq("id", id).eq("user_id", expectedUserId).maybeSingle();
  if (!existing) return false;
  const drill = existing.drill as Record<string, unknown>;
  const next = drill.kind === "workout" ? { ...drill, title } : { ...drill, name: title };
  const { data, error } = await supabase
    .from("custom_drills").update({ drill: next }).eq("id", id).eq("user_id", expectedUserId).select("id");
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

export async function getMyProfile(expectedUserId: string): Promise<Profile | null> {
  if (!supabase) return null;
  if (!(await userMatches(expectedUserId))) return null;
  const { data: p, error } = await supabase.from("profiles").select("*").eq("user_id", expectedUserId).maybeSingle();
  if (error) throw error;
  if (!(await userMatches(expectedUserId))) return null;
  return (p as Profile) ?? null;
}

export async function setMyProfile(
  expectedUserId: string, isPublic: boolean, displayName: string, utr = "", usta = "",
): Promise<boolean> {
  if (!supabase) return false;
  if (!(await userMatches(expectedUserId))) return false;
  const { error } = await supabase.from("profiles").upsert({
    user_id: expectedUserId,
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
  const { data, error } = await supabase.rpc("get_public_player_profile", { p_user_id: userId });
  if (error || !data || typeof data !== "object") return { profile: null, sessions: [] };
  const result = data as { profile?: Profile; sessions?: SessionRow[] };
  return { profile: result.profile ?? null, sessions: result.sessions ?? [] };
}
