// Per-user session history + shareable coach summaries, stored in Supabase.
// Row-level security keeps each user's sessions private; shares are readable by
// anyone with the link.

import { supabase } from "./supabase";
import type { PoseAnalysis } from "./pose";
import type { Workout } from "./types";

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
