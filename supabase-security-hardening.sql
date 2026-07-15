-- TopSpin security hardening after coach-layer Phase 1b.
-- Run once in Supabase SQL Editor after the earlier coach-layer migrations.
-- This is additive and intentionally replaces unsafe policies/functions.

-- 1. Revoke every old guardian URL. Earlier links placed tokens in URL paths,
-- which could reach logs. New links use a browser fragment and are never sent
-- in an HTTP request.
delete from public.consent_tokens;

-- Atomic consent initialization. The advisory lock also serializes the case
-- where no row exists yet, so concurrent adult/minor requests cannot race.
create or replace function public.initialize_account_consent(
  p_user_id uuid, p_birth_year integer, p_guardian_email text
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_existing text;
  v_status text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select consent_status into v_existing
    from public.account_consent where user_id = p_user_id for update;
  if v_existing in ('pending', 'approved') then return v_existing; end if;
  if p_birth_year < extract(year from now())::int - 120
     or p_birth_year > extract(year from now())::int then
    raise exception 'invalid birth year';
  end if;
  v_status := case
    when extract(year from now())::int - p_birth_year <= 16 then 'pending'
    else 'not_required'
  end;
  if v_status = 'pending' and coalesce(trim(p_guardian_email), '') = '' then
    raise exception 'guardian email required';
  end if;
  insert into public.account_consent(user_id, birth_year, guardian_email, consent_status)
  values (p_user_id, p_birth_year,
    case when v_status = 'pending' then lower(trim(p_guardian_email)) else null end,
    v_status)
  on conflict (user_id) do update set
    birth_year = excluded.birth_year,
    guardian_email = excluded.guardian_email,
    consent_status = excluded.consent_status;
  return v_status;
end;
$$;
revoke all on function public.initialize_account_consent(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.initialize_account_consent(uuid, integer, text) to service_role;

-- Atomic token replacement and redemption. A transaction can no longer burn a
-- valid token without also approving the consent row.
create or replace function public.issue_consent_token(
  p_user_id uuid, p_token_hash text, p_expires_at timestamptz
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 1));
  delete from public.consent_tokens where user_id = p_user_id and used_at is null;
  insert into public.consent_tokens(user_id, token_hash, expires_at)
    values (p_user_id, p_token_hash, p_expires_at);
  update public.account_consent set requested_at = now() where user_id = p_user_id;
  if not found then
    raise exception 'Consent row does not exist for user';
  end if;
  return true;
end;
$$;
revoke all on function public.issue_consent_token(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.issue_consent_token(uuid, text, timestamptz) to service_role;

create or replace function public.redeem_consent_token(p_token_hash text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_token public.consent_tokens%rowtype;
begin
  select * into v_token from public.consent_tokens
    where token_hash = p_token_hash and used_at is null and expires_at > now()
    for update;
  if not found then return false; end if;
  update public.account_consent
    set consent_status = 'approved', approved_at = now()
    where user_id = v_token.user_id and consent_status = 'pending';
  if not found then return false; end if;
  update public.consent_tokens set used_at = now() where id = v_token.id;
  return true;
end;
$$;
revoke all on function public.redeem_consent_token(text) from public, anon, authenticated;
grant execute on function public.redeem_consent_token(text) to service_role;

-- 2. Pending minors are local-only. Block every ordinary cloud write, not just
-- coach summaries, and remove any rows written before this policy existed.
drop policy if exists "own sessions write" on public.sessions;
create policy "own sessions write" on public.sessions for insert
  with check (auth.uid() = user_id and public.consent_ok());
drop policy if exists "own drills write" on public.custom_drills;
drop policy if exists "own drills update" on public.custom_drills;
create policy "own drills write" on public.custom_drills for insert
  with check (auth.uid() = user_id and public.consent_ok());
create policy "own drills update" on public.custom_drills for update
  using (auth.uid() = user_id and public.consent_ok())
  with check (auth.uid() = user_id and public.consent_ok());
drop policy if exists "own profile write" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
create policy "own profile write" on public.profiles for insert
  with check (auth.uid() = user_id and public.consent_ok());
create policy "own profile update" on public.profiles for update
  using (auth.uid() = user_id and public.consent_ok())
  with check (auth.uid() = user_id and public.consent_ok());

delete from public.sessions s using public.account_consent c
  where s.user_id = c.user_id and c.consent_status = 'pending';
delete from public.custom_drills d using public.account_consent c
  where d.user_id = c.user_id and c.consent_status = 'pending';
delete from public.profiles p using public.account_consent c
  where p.user_id = c.user_id and c.consent_status = 'pending';

-- 3. Shares are owner-created, expiring, size-bounded, and not table-readable.
alter table public.shares add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.shares add column if not exists expires_at timestamptz not null default (now() + interval '30 days');
alter table public.shares drop constraint if exists shares_payload_size;
alter table public.shares add constraint shares_payload_size
  check (pg_column_size(payload) <= 65536) not valid;
drop policy if exists "anyone read shares" on public.shares;
drop policy if exists "anyone write shares" on public.shares;
drop policy if exists "owner inserts shares" on public.shares;
drop policy if exists "owner deletes shares" on public.shares;
create policy "owner inserts shares" on public.shares for insert
  with check (auth.uid() = user_id and public.consent_ok());
create policy "owner deletes shares" on public.shares for delete using (auth.uid() = user_id);

create or replace function public.get_share_by_id(p_id text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_payload jsonb;
begin
  if p_id !~ '^[A-Za-z0-9_-]{20,64}$' then return null; end if;
  select payload into v_payload from public.shares
    where id = p_id and user_id is not null and expires_at > now();
  return v_payload;
end;
$$;
revoke all on function public.get_share_by_id(text) from public;
grant execute on function public.get_share_by_id(text) to anon, authenticated;

-- 4. Public profiles expose only trend/stat columns, never flaws or joint data.
drop policy if exists "public sessions read" on public.sessions;
drop policy if exists "public profile read" on public.profiles;
drop policy if exists "coach reads squad player profiles" on public.profiles;

create or replace function public.get_public_player_profile(p_user_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_profile public.profiles%rowtype;
begin
  select * into v_profile from public.profiles
    where user_id = p_user_id and is_public = true
      and exists (
        select 1 from public.account_consent c
        where c.user_id = p_user_id and c.consent_status in ('not_required', 'approved')
      );
  if not found then return null; end if;
  return jsonb_build_object(
    'profile', jsonb_build_object(
      'user_id', v_profile.user_id,
      'is_public', true,
      'display_name', v_profile.display_name,
      'utr', v_profile.utr,
      'usta', v_profile.usta
    ),
    'sessions', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select id, created_at, stroke, form_score, serve_speed
        from public.sessions where user_id = p_user_id
        order by created_at desc limit 200
      ) x
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.get_public_player_profile(uuid) from public;
grant execute on function public.get_public_player_profile(uuid) to anon, authenticated;

-- 5. Bind summaries to the exact squad that owned them. Membership changes
-- delete old-squad summaries, preventing a new coach from inheriting history.
alter table public.player_summaries add column if not exists squad_id uuid references public.squads(id) on delete cascade;
update public.player_summaries ps set squad_id = m.squad_id
  from public.squad_members m where m.player_id = ps.player_id and ps.squad_id is null;
delete from public.player_summaries where squad_id is null;
alter table public.player_summaries alter column squad_id set not null;
drop policy if exists "player writes own summary" on public.player_summaries;
drop policy if exists "coach reads squad summaries" on public.player_summaries;
create policy "player writes own summary" on public.player_summaries for insert
  with check (
    auth.uid() = player_id and public.consent_ok()
    and exists (select 1 from public.squad_members m where m.player_id = auth.uid() and m.squad_id = squad_id)
  );
create policy "coach reads squad summaries" on public.player_summaries for select using (
  exists (select 1 from public.squads s where s.id = player_summaries.squad_id and s.coach_id = auth.uid())
);

create or replace function public.delete_departed_squad_summaries()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.player_summaries where player_id = old.player_id and squad_id = old.squad_id;
  return old;
end;
$$;
drop trigger if exists clean_summaries_after_membership_delete on public.squad_members;
create trigger clean_summaries_after_membership_delete
  after delete on public.squad_members for each row execute function public.delete_departed_squad_summaries();

-- Old path-based links and any pre-migration anonymous shares are intentionally
-- invalid after this migration. This is a privacy reset, not data loss from a
-- private account: users can create a fresh share link when needed.
delete from public.shares where user_id is null;
