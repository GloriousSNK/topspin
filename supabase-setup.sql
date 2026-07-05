-- TopSpin — Supabase schema.
-- Paste this whole file into the Supabase SQL editor and run it once.
-- Safe to re-run: everything uses "if not exists" / "or replace".
--
-- If your "Save drill" / "Save workout" buttons do nothing, it's almost always
-- because the custom_drills table below doesn't exist yet. Run this and it works.

-- ---------------------------------------------------------------------------
-- 1. Saved analyses (one row per clip you analyse)
-- ---------------------------------------------------------------------------
create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  stroke      text,
  form_score  int,
  serve_speed int,
  flaws         jsonb,
  joint_feedback jsonb
);
alter table public.sessions enable row level security;

drop policy if exists "own sessions read"   on public.sessions;
drop policy if exists "own sessions write"  on public.sessions;
drop policy if exists "own sessions delete" on public.sessions;
create policy "own sessions read"   on public.sessions for select using (auth.uid() = user_id);
create policy "own sessions write"  on public.sessions for insert with check (auth.uid() = user_id);
create policy "own sessions delete" on public.sessions for delete using (auth.uid() = user_id);

-- Public read of another player's sessions IF their profile is public.
drop policy if exists "public sessions read" on public.sessions;
create policy "public sessions read" on public.sessions for select using (
  exists (
    select 1 from public.profiles p
    where p.user_id = sessions.user_id and p.is_public = true
  )
);

-- ---------------------------------------------------------------------------
-- 2. Saved drills & workouts  (this is what the Save buttons write to)
-- ---------------------------------------------------------------------------
create table if not exists public.custom_drills (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  drill      jsonb not null           -- a drill, or {kind:"workout", ...} for a whole workout
);
alter table public.custom_drills enable row level security;

drop policy if exists "own drills read"   on public.custom_drills;
drop policy if exists "own drills write"  on public.custom_drills;
drop policy if exists "own drills delete" on public.custom_drills;
create policy "own drills read"   on public.custom_drills for select using (auth.uid() = user_id);
create policy "own drills write"  on public.custom_drills for insert with check (auth.uid() = user_id);
create policy "own drills delete" on public.custom_drills for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. Public player profiles (shareable /u/<id> cards)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  is_public    boolean not null default false,
  display_name text,
  utr          text,
  usta         text
);
alter table public.profiles enable row level security;

drop policy if exists "own profile read"   on public.profiles;
drop policy if exists "own profile write"  on public.profiles;
drop policy if exists "public profile read" on public.profiles;
create policy "own profile read"    on public.profiles for select using (auth.uid() = user_id);
create policy "own profile write"   on public.profiles for insert with check (auth.uid() = user_id);
create policy "own profile update"  on public.profiles for update using (auth.uid() = user_id);
create policy "public profile read" on public.profiles for select using (is_public = true);

-- ---------------------------------------------------------------------------
-- 4. Shareable coach summaries (readable by anyone with the link)
-- ---------------------------------------------------------------------------
create table if not exists public.shares (
  id         text primary key,
  created_at timestamptz not null default now(),
  payload    jsonb not null
);
alter table public.shares enable row level security;

drop policy if exists "anyone read shares"  on public.shares;
drop policy if exists "anyone write shares" on public.shares;
create policy "anyone read shares"  on public.shares for select using (true);
create policy "anyone write shares" on public.shares for insert with check (true);
