-- ============================================================================
-- TopSpin — Coach Layer schema (Phase 1a)
--
-- Run this in the Supabase SQL editor AFTER supabase-setup.sql. Safe to re-run.
--
-- Design goals (see docs/coach-layer-threat-model.md):
--   * Accounts are OPT-IN. Everything here is additive; the account-free app is
--     untouched.
--   * DATA MINIMISATION. A coach can read only a player's *summary* rows and
--     display name — never raw pose data, never the consent record, never a
--     player they aren't linked to. Column-level minimisation is enforced by
--     splitting data across tables, since RLS is row-level only.
--   * The coach <-> player link is checked on EVERY read via RLS, not just at
--     join time.
--   * Joining is done through a SECURITY DEFINER function so players never get
--     blanket read access to the squads table (no squad-code enumeration).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. Consent + age gate (private to the owner; coaches never see this)
-- ---------------------------------------------------------------------------
-- One row per account. Created at signup. `birth_year` is a coarse age band,
-- not a full date of birth (lower-data by design). consent_status:
--   'not_required' - adult, or above the age line for their region
--   'pending'      - minor awaiting guardian approval; NO sync allowed
--   'approved'     - guardian approved; sync allowed
create table if not exists public.account_consent (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  created_at     timestamptz not null default now(),
  birth_year     int,
  guardian_email text,
  consent_status text not null default 'not_required'
                 check (consent_status in ('not_required', 'pending', 'approved')),
  requested_at   timestamptz,
  approved_at    timestamptz
);
alter table public.account_consent enable row level security;

-- Owner-only. Coaches and everyone else get nothing. The guardian-approval
-- path runs server-side with the service role, which bypasses RLS.
drop policy if exists "own consent read"   on public.account_consent;
drop policy if exists "own consent write"  on public.account_consent;
drop policy if exists "own consent update" on public.account_consent;
create policy "own consent read"   on public.account_consent for select using (auth.uid() = user_id);
create policy "own consent write"  on public.account_consent for insert with check (auth.uid() = user_id);
-- The owner can set their own band/guardian email, but must NOT be able to
-- self-approve. Approval only flips to 'approved' via the service role.
create policy "own consent update" on public.account_consent for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and consent_status in ('not_required', 'pending'));

-- Helper: is the current user cleared to sync? (consent row exists and is ok)
create or replace function public.consent_ok()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.account_consent c
    where c.user_id = auth.uid()
      and c.consent_status in ('not_required', 'approved')
  );
$$;

-- ---------------------------------------------------------------------------
-- B. Squads (a coach's group) + membership
-- ---------------------------------------------------------------------------
create table if not exists public.squads (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references auth.users (id) on delete cascade,
  code       text not null unique,               -- short, shareable (6 chars)
  name       text not null default 'My squad',
  created_at timestamptz not null default now()
);
alter table public.squads enable row level security;

-- A coach fully controls their own squads. There is intentionally NO general
-- read policy: players never SELECT this table directly (they join via the
-- join_squad() function below), so squad codes can't be enumerated.
drop policy if exists "coach owns squads read"   on public.squads;
drop policy if exists "coach owns squads write"  on public.squads;
drop policy if exists "coach owns squads update" on public.squads;
drop policy if exists "coach owns squads delete" on public.squads;
create policy "coach owns squads read"   on public.squads for select using (auth.uid() = coach_id);
create policy "coach owns squads write"  on public.squads for insert with check (auth.uid() = coach_id);
create policy "coach owns squads update" on public.squads for update using (auth.uid() = coach_id);
create policy "coach owns squads delete" on public.squads for delete using (auth.uid() = coach_id);

-- One active membership per player (a player is linked to exactly one coach).
create table if not exists public.squad_members (
  id        uuid primary key default gen_random_uuid(),
  squad_id  uuid not null references public.squads (id) on delete cascade,
  player_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (player_id)
);
alter table public.squad_members enable row level security;

-- Player sees their own membership; coach sees members of squads they own.
-- Inserts happen only through join_squad() (definer), so there is no insert
-- policy here — direct inserts are denied.
drop policy if exists "player reads own membership" on public.squad_members;
drop policy if exists "coach reads squad members"   on public.squad_members;
drop policy if exists "player leaves squad"         on public.squad_members;
drop policy if exists "coach removes member"        on public.squad_members;
create policy "player reads own membership" on public.squad_members for select using (auth.uid() = player_id);
create policy "coach reads squad members"   on public.squad_members for select using (
  exists (select 1 from public.squads s where s.id = squad_members.squad_id and s.coach_id = auth.uid())
);
create policy "player leaves squad" on public.squad_members for delete using (auth.uid() = player_id);
create policy "coach removes member" on public.squad_members for delete using (
  exists (select 1 from public.squads s where s.id = squad_members.squad_id and s.coach_id = auth.uid())
);

-- ---------------------------------------------------------------------------
-- C. Player summaries (the ONLY thing that syncs to a coach by default)
-- ---------------------------------------------------------------------------
-- Summary-only: score, stroke, drill completion, timestamp. Deliberately NO
-- video, NO full pose/flaw breakdown (those live in the private `sessions`
-- table and never reach a coach unless the player explicitly shares a clip).
create table if not exists public.player_summaries (
  id               uuid primary key default gen_random_uuid(),
  player_id        uuid not null references auth.users (id) on delete cascade,
  created_at       timestamptz not null default now(),
  stroke           text,
  form_score       int,
  drills_completed int not null default 0
);
alter table public.player_summaries enable row level security;

-- Player owns their summaries. Writing is gated on consent_ok() so a minor
-- awaiting guardian approval cannot sync anything.
drop policy if exists "player reads own summary"  on public.player_summaries;
drop policy if exists "player writes own summary" on public.player_summaries;
drop policy if exists "player deletes own summary" on public.player_summaries;
drop policy if exists "coach reads squad summaries" on public.player_summaries;
create policy "player reads own summary"  on public.player_summaries for select using (auth.uid() = player_id);
create policy "player writes own summary" on public.player_summaries for insert
  with check (auth.uid() = player_id and public.consent_ok());
create policy "player deletes own summary" on public.player_summaries for delete using (auth.uid() = player_id);

-- The coach<->player link, checked on EVERY read.
create policy "coach reads squad summaries" on public.player_summaries for select using (
  exists (
    select 1
    from public.squad_members m
    join public.squads s on s.id = m.squad_id
    where m.player_id = player_summaries.player_id
      and s.coach_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- D. Coach reads squad players' display name (for the roster) — nothing else
-- ---------------------------------------------------------------------------
-- Lets a coach show a player's name on the roster. profiles holds only
-- shareable display data; consent/guardian info is in account_consent, which
-- coaches cannot read.
drop policy if exists "coach reads squad player profiles" on public.profiles;
create policy "coach reads squad player profiles" on public.profiles for select using (
  exists (
    select 1
    from public.squad_members m
    join public.squads s on s.id = m.squad_id
    where m.player_id = profiles.user_id
      and s.coach_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- E. join_squad(): the only way a player joins — validates consent, prevents
--    squad-table enumeration, enforces one-squad-per-player.
-- ---------------------------------------------------------------------------
create or replace function public.join_squad(p_code text)
returns table (squad_id uuid, squad_name text)
language plpgsql security definer set search_path = public as $$
declare
  v_squad public.squads%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.consent_ok() then
    raise exception 'consent required before joining a squad' using errcode = '42501';
  end if;

  select * into v_squad from public.squads where code = upper(trim(p_code));
  if not found then
    raise exception 'no squad with that code' using errcode = 'no_data_found';
  end if;

  -- one active membership per player: replace any existing one
  delete from public.squad_members where player_id = auth.uid();
  insert into public.squad_members (squad_id, player_id) values (v_squad.id, auth.uid());

  squad_id := v_squad.id;
  squad_name := v_squad.name;
  return next;
end;
$$;

revoke all on function public.join_squad(text) from public;
grant execute on function public.join_squad(text) to authenticated;
