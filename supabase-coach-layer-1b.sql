-- ============================================================================
-- TopSpin — Coach Layer schema (Phase 1b): consent flow server-side pieces
--
-- Run this in the Supabase SQL editor AFTER supabase-coach-layer.sql. Safe to
-- re-run. This migration closes the threat-model items tagged TODO(1b/1c):
--   * T6 — single-use, expiring guardian-consent tokens (consent_tokens).
--   * T5/T6 — a user can no longer INSERT their own row as 'approved'; approval
--     is server-only (service role) via a verified token.
--   * T9 — leaving a squad also deletes that player's synced summaries, so no
--     shared data lingers on the backend after the link is cut.
--
-- The approval/request routes run server-side with the SERVICE ROLE, which
-- bypasses RLS. consent_tokens therefore has NO policies for the anon/auth
-- roles — RLS is on and denies everyone except the service role.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. Guardian consent tokens (T6): single-use, expiring, service-role only.
-- ---------------------------------------------------------------------------
-- We store only a SHA-256 hash of the token, never the token itself, so a leak
-- of this table can't be replayed against the approval route. The raw token
-- lives only in the guardian's email link.
create table if not exists public.consent_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz
);
alter table public.consent_tokens enable row level security;

-- Intentionally NO policies: with RLS enabled and no permissive policy, the
-- anon and authenticated roles can neither read nor write. Only the service
-- role (used by the /api/consent/* route handlers) can touch this table.
-- A player can't enumerate, forge, or read guardian tokens.
create index if not exists consent_tokens_user_idx on public.consent_tokens (user_id);

-- ---------------------------------------------------------------------------
-- B. account_consent is READ-ONLY to the client; the service role owns writes.
-- ---------------------------------------------------------------------------
-- The 1a policies let the OWNER insert and update their own consent row. That
-- is unsafe: the UPDATE policy's WITH CHECK permitted consent_status =
-- 'not_required', so a minor whose account was 'pending' could bypass the whole
-- guardian gate with a single client-side
--     update account_consent set consent_status = 'not_required'
-- (the flip to 'approved' was already blocked, but 'not_required' clears the
-- gate just as effectively via consent_ok()).
--
-- All legitimate writes now go through the /api/consent/* route handlers, which
-- use the service role (bypasses RLS) and derive the status server-side from a
-- declared birth year. So the client needs NO write or update access at all.
-- We drop both, leaving only the owner SELECT (kept from 1a) so the account
-- page can display its own consent status. A client can no longer create,
-- clear, or approve its own consent by any direct query.
drop policy if exists "own consent write"  on public.account_consent;
drop policy if exists "own consent update" on public.account_consent;
-- ("own consent read" from supabase-coach-layer.sql stays as the only client
--  policy; with RLS enabled and no insert/update policy, direct writes fail.)

-- ---------------------------------------------------------------------------
-- C. leave_squad() (T9): drop membership AND wipe this player's summaries.
-- ---------------------------------------------------------------------------
-- Summaries exist only to be visible to a squad coach. When a player leaves,
-- the sync relationship is gone, so the synced data should not linger on the
-- backend. Deleting the auth user still cascades everything (right to be
-- forgotten); this handles the lighter "leave the squad" case.
create or replace function public.leave_squad()
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from public.squad_members   where player_id = auth.uid();
  delete from public.player_summaries where player_id = auth.uid();
end;
$$;

revoke all on function public.leave_squad() from public;
grant execute on function public.leave_squad() to authenticated;
