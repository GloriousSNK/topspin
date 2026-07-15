-- TopSpin complete coach-layer migration.
-- Run after supabase-security-hardening.sql.

-- Account roles are explicit. A user chooses once; changing roles later needs
-- an administrator so player and coach permissions cannot be swapped casually.
create table if not exists public.account_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('player', 'coach')),
  created_at timestamptz not null default now()
);
alter table public.account_roles enable row level security;
drop policy if exists "owner reads account role" on public.account_roles;
create policy "owner reads account role" on public.account_roles for select
  using (auth.uid() = user_id);

create or replace function public.choose_account_role(p_role text)
returns text language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_role not in ('player', 'coach') then raise exception 'invalid role'; end if;
  if not public.consent_ok() then raise exception 'consent required' using errcode = '42501'; end if;
  insert into public.account_roles(user_id, role) values (auth.uid(), p_role)
    on conflict (user_id) do nothing;
  select role into v_role from public.account_roles where user_id = auth.uid();
  return v_role;
end;
$$;
revoke all on function public.choose_account_role(text) from public;
grant execute on function public.choose_account_role(text) to authenticated;

-- Creating squads happens through an RPC so codes are generated server-side.
create or replace function public.create_my_squad(p_name text default 'My squad')
returns table (squad_id uuid, squad_name text, squad_code text)
language plpgsql security definer set search_path = public as $$
declare v_code text; v_id uuid; v_name text;
begin
  if not exists (select 1 from public.account_roles where user_id = auth.uid() and role = 'coach')
    then raise exception 'coach account required' using errcode = '42501'; end if;
  v_name := left(coalesce(nullif(trim(p_name), ''), 'My squad'), 60);
  loop
    -- gen_random_uuid() is built into modern Postgres. Unlike pgcrypto's
    -- gen_random_bytes(), it remains available with search_path = public.
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.squads where code = v_code);
  end loop;
  insert into public.squads(coach_id, code, name) values (auth.uid(), v_code, v_name)
    returning id into v_id;
  return query select v_id, v_name, v_code;
end;
$$;
revoke all on function public.create_my_squad(text) from public;
grant execute on function public.create_my_squad(text) to authenticated;

-- Rate-limit code guesses in the database, where it works across serverless
-- instances and cannot be reset by restarting an app process.
create table if not exists public.squad_join_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
alter table public.squad_join_attempts enable row level security;
create index if not exists squad_join_attempts_user_time_idx
  on public.squad_join_attempts(user_id, attempted_at desc);

create or replace function public.join_squad(p_code text)
returns table (squad_id uuid, squad_name text)
language plpgsql security definer set search_path = public as $$
declare v_squad public.squads%rowtype; v_count int;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public.consent_ok() then raise exception 'consent required' using errcode = '42501'; end if;
  if not exists (select 1 from public.account_roles where user_id = auth.uid() and role = 'player')
    then raise exception 'player account required' using errcode = '42501'; end if;
  delete from public.squad_join_attempts where attempted_at < now() - interval '1 day';
  select count(*) into v_count from public.squad_join_attempts
    where user_id = auth.uid() and attempted_at > now() - interval '15 minutes';
  if v_count >= 10 then raise exception 'too many attempts; try again later' using errcode = 'P0001'; end if;
  insert into public.squad_join_attempts(user_id) values (auth.uid());
  select * into v_squad from public.squads where code = upper(trim(p_code));
  if not found then raise exception 'no squad with that code' using errcode = 'P0002'; end if;
  delete from public.squad_members where player_id = auth.uid();
  insert into public.squad_members(squad_id, player_id) values (v_squad.id, auth.uid());
  squad_id := v_squad.id; squad_name := v_squad.name; return next;
end;
$$;
revoke all on function public.join_squad(text) from public;
grant execute on function public.join_squad(text) to authenticated;

create or replace function public.get_my_coach_context()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'role', (select role from public.account_roles where user_id = auth.uid()),
    'squads', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'code', s.code))
      from public.squads s where s.coach_id = auth.uid()), '[]'::jsonb),
    'membership', (select jsonb_build_object('squad_id', s.id, 'squad_name', s.name, 'coach_name', coalesce(p.display_name, 'Your coach'))
      from public.squad_members m join public.squads s on s.id = m.squad_id
      left join public.profiles p on p.user_id = s.coach_id where m.player_id = auth.uid())
  );
$$;
revoke all on function public.get_my_coach_context() from public;
grant execute on function public.get_my_coach_context() to authenticated;

-- Summary sync accepts only the fields the coach dashboard needs.
create or replace function public.sync_player_summary(p_stroke text, p_form_score int, p_drills_completed int default 0)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_squad uuid; v_id uuid;
begin
  if not public.consent_ok() then return null; end if;
  select squad_id into v_squad from public.squad_members where player_id = auth.uid();
  if v_squad is null then return null; end if;
  insert into public.player_summaries(player_id, squad_id, stroke, form_score, drills_completed)
    values (auth.uid(), v_squad, left(p_stroke, 30),
      case when p_form_score is null then null else greatest(0, least(100, p_form_score)) end,
      greatest(0, least(1000, p_drills_completed)))
    returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.sync_player_summary(text, int, int) from public;
grant execute on function public.sync_player_summary(text, int, int) to authenticated;

create table if not exists public.practice_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  drills_completed int not null default 0 check (drills_completed between 0 and 1000),
  completed_at timestamptz not null default now()
);
alter table public.practice_completions enable row level security;
drop policy if exists "owner reads practice" on public.practice_completions;
drop policy if exists "owner deletes practice" on public.practice_completions;
create policy "owner reads practice" on public.practice_completions for select using (auth.uid() = user_id);
create policy "owner deletes practice" on public.practice_completions for delete using (auth.uid() = user_id);

create or replace function public.complete_practice(p_title text, p_drills_completed int)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_squad uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public.consent_ok() then raise exception 'consent required' using errcode = '42501'; end if;
  insert into public.practice_completions(user_id, title, drills_completed)
    values (auth.uid(), left(coalesce(nullif(trim(p_title), ''), 'Practice session'), 100), greatest(0, least(1000, p_drills_completed)))
    returning id into v_id;
  select squad_id into v_squad from public.squad_members where player_id = auth.uid();
  if v_squad is not null then
    insert into public.player_summaries(player_id, squad_id, stroke, form_score, drills_completed)
      values (auth.uid(), v_squad, left(coalesce(nullif(trim(p_title), ''), 'Practice session'), 30), null, greatest(0, least(1000, p_drills_completed)));
  end if;
  return v_id;
end;
$$;
revoke all on function public.complete_practice(text, int) from public;
grant execute on function public.complete_practice(text, int) to authenticated;

-- Coach roster and history are exposed through relationship-checking RPCs,
-- never broad table reads.
create or replace function public.get_coach_roster()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(row_to_json(r) order by r.display_name), '[]'::jsonb) from (
    select m.player_id, m.squad_id, s.name as squad_name,
      coalesce(p.display_name, 'Player') as display_name,
      latest.form_score as latest_score, activity.created_at as last_active,
      case when prior.form_score is null or latest.form_score is null then 'new'
           when latest.form_score >= prior.form_score + 4 then 'improving'
           when latest.form_score <= prior.form_score - 4 then 'declining'
           else 'steady' end as trend
    from public.squad_members m
    join public.squads s on s.id = m.squad_id and s.coach_id = auth.uid()
    left join public.profiles p on p.user_id = m.player_id
    left join lateral (select form_score, created_at from public.player_summaries ps
      where ps.player_id = m.player_id and ps.squad_id = m.squad_id and form_score is not null order by created_at desc limit 1) latest on true
    left join lateral (select created_at from public.player_summaries ps
      where ps.player_id = m.player_id and ps.squad_id = m.squad_id order by created_at desc limit 1) activity on true
    left join lateral (select form_score from public.player_summaries ps
      where ps.player_id = m.player_id and ps.squad_id = m.squad_id and form_score is not null order by created_at desc offset 4 limit 1) prior on true
  ) r;
$$;
revoke all on function public.get_coach_roster() from public;
grant execute on function public.get_coach_roster() to authenticated;

create or replace function public.get_coach_player_history(p_player_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_squad uuid; v_name text;
begin
  select m.squad_id, coalesce(p.display_name, 'Player') into v_squad, v_name
    from public.squad_members m join public.squads s on s.id = m.squad_id and s.coach_id = auth.uid()
    left join public.profiles p on p.user_id = m.player_id where m.player_id = p_player_id;
  if v_squad is null then return null; end if;
  return jsonb_build_object('player_id', p_player_id, 'display_name', v_name,
    'summaries', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at)
      from (select id, created_at, stroke, form_score, drills_completed from public.player_summaries
        where player_id = p_player_id and squad_id = v_squad order by created_at desc limit 100) x), '[]'::jsonb));
end;
$$;
revoke all on function public.get_coach_player_history(uuid) from public;
grant execute on function public.get_coach_player_history(uuid) to authenticated;

-- Explicit analysis shares. Raw clips remain local; the payload is the exact
-- breakdown the player chooses to send. Coach notes are short and auditable.
create table if not exists public.coach_analysis_shares (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references auth.users(id) on delete cascade,
  squad_id uuid not null references public.squads(id) on delete cascade,
  payload jsonb not null check (pg_column_size(payload) <= 65536),
  coach_note text check (char_length(coach_note) <= 1000),
  created_at timestamptz not null default now(),
  noted_at timestamptz
);
alter table public.coach_analysis_shares enable row level security;
drop policy if exists "player reads shared analyses" on public.coach_analysis_shares;
drop policy if exists "coach reads shared analyses" on public.coach_analysis_shares;
drop policy if exists "coach annotates shared analyses" on public.coach_analysis_shares;
create policy "player reads shared analyses" on public.coach_analysis_shares for select using (auth.uid() = player_id);
create policy "coach reads shared analyses" on public.coach_analysis_shares for select using (
  exists (select 1 from public.squads s where s.id = squad_id and s.coach_id = auth.uid()));
create policy "coach annotates shared analyses" on public.coach_analysis_shares for update using (
  exists (select 1 from public.squads s where s.id = squad_id and s.coach_id = auth.uid()))
  with check (exists (select 1 from public.squads s where s.id = squad_id and s.coach_id = auth.uid()));

create or replace function public.share_analysis_with_coach(p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_squad uuid; v_id uuid;
begin
  if not public.consent_ok() then raise exception 'consent required' using errcode = '42501'; end if;
  if pg_column_size(p_payload) > 65536 then raise exception 'analysis is too large'; end if;
  select squad_id into v_squad from public.squad_members where player_id = auth.uid();
  if v_squad is null then raise exception 'join a squad first'; end if;
  insert into public.coach_analysis_shares(player_id, squad_id, payload)
    values (auth.uid(), v_squad, p_payload) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.share_analysis_with_coach(jsonb) from public;
grant execute on function public.share_analysis_with_coach(jsonb) to authenticated;

-- Public-by-link parent reports use unguessable client-generated ids, expire,
-- and contain only the coach-selected summary payload.
create table if not exists public.parent_reports (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{24,64}$'),
  coach_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null check (pg_column_size(payload) <= 65536),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
alter table public.parent_reports enable row level security;

create or replace function public.create_parent_report(p_id text, p_player_id uuid, p_payload jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_id !~ '^[A-Za-z0-9_-]{24,64}$' or pg_column_size(p_payload) > 65536 then return false; end if;
  if not exists (select 1 from public.squad_members m join public.squads s on s.id = m.squad_id
    where m.player_id = p_player_id and s.coach_id = auth.uid()) then return false; end if;
  insert into public.parent_reports(id, coach_id, player_id, payload)
    values (p_id, auth.uid(), p_player_id, p_payload);
  return true;
end;
$$;
revoke all on function public.create_parent_report(text, uuid, jsonb) from public;
grant execute on function public.create_parent_report(text, uuid, jsonb) to authenticated;

create or replace function public.get_parent_report(p_id text)
returns jsonb language sql stable security definer set search_path = public as $$
  select payload from public.parent_reports where id = p_id and expires_at > now();
$$;
revoke all on function public.get_parent_report(text) from public;
grant execute on function public.get_parent_report(text) to anon, authenticated;

-- Leaving a squad also removes every coach-visible artifact for that link.
create or replace function public.leave_squad()
returns void language plpgsql security definer set search_path = public as $$
declare v_squad uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select squad_id into v_squad from public.squad_members where player_id = auth.uid();
  delete from public.coach_analysis_shares where player_id = auth.uid() and squad_id = v_squad;
  delete from public.parent_reports where player_id = auth.uid();
  delete from public.player_summaries where player_id = auth.uid();
  delete from public.squad_members where player_id = auth.uid();
end;
$$;
revoke all on function public.leave_squad() from public;
grant execute on function public.leave_squad() to authenticated;
