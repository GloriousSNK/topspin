-- TopSpin coach-managed student folders.
-- Run after supabase-squad-code-fix.sql. Safe to re-run.
--
-- Coaches film and analyse students who will never make a TopSpin account. These
-- tables let a coach file those analyses under a named folder they own. A folder
-- is the coach's private notebook: the student has no login and no link to any
-- other table, and only the owning coach can read or change it.
--
-- Stored: the name and notes the coach types, plus the same analysis summary that
-- `sessions` already holds (stroke, score, flaws, joint readings, contact-frame
-- skeleton). Not stored: the clip, birth year, email, photo or any contact detail.
-- The UI asks for a first name or nickname.

-- Helper: is the caller a coach account?
create or replace function public.is_coach()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.account_roles where user_id = auth.uid() and role = 'coach'
  );
$$;
revoke all on function public.is_coach() from public;
grant execute on function public.is_coach() to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Folders (one per student)
-- ---------------------------------------------------------------------------
create table if not exists public.coach_students (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  note        text check (note is null or char_length(note) <= 2000),
  created_at  timestamptz not null default now(),
  -- Lets analyses reference (student, coach) together, so a row can never be
  -- filed into a folder that belongs to a different coach.
  unique (id, coach_id)
);
create index if not exists coach_students_coach_idx on public.coach_students (coach_id);
alter table public.coach_students enable row level security;

drop policy if exists "coach reads own students"   on public.coach_students;
drop policy if exists "coach adds students"        on public.coach_students;
drop policy if exists "coach edits own students"   on public.coach_students;
drop policy if exists "coach deletes own students" on public.coach_students;
create policy "coach reads own students" on public.coach_students for select
  using (auth.uid() = coach_id);
create policy "coach adds students" on public.coach_students for insert
  with check (auth.uid() = coach_id and public.is_coach() and public.consent_ok());
create policy "coach edits own students" on public.coach_students for update
  using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id and public.is_coach() and public.consent_ok());
create policy "coach deletes own students" on public.coach_students for delete
  using (auth.uid() = coach_id);

-- ---------------------------------------------------------------------------
-- 2. Analyses filed under a folder
-- ---------------------------------------------------------------------------
create table if not exists public.coach_student_analyses (
  id             uuid primary key default gen_random_uuid(),
  coach_id       uuid not null references auth.users (id) on delete cascade,
  student_id     uuid not null,
  created_at     timestamptz not null default now(),
  title          text check (title is null or char_length(title) <= 80),
  stroke         text check (stroke is null or char_length(stroke) <= 24),
  form_score     int  check (form_score is null or form_score between 0 and 100),
  serve_speed    int  check (serve_speed is null or serve_speed between 0 and 400),
  flaws          jsonb,
  joint_feedback jsonb,
  skeleton       jsonb,
  starred        boolean not null default false,
  note           text check (note is null or char_length(note) <= 2000),
  foreign key (student_id, coach_id)
    references public.coach_students (id, coach_id) on delete cascade,
  -- Summaries are a few KB. Cap them so the table can't be used as blob storage.
  check (coalesce(pg_column_size(flaws), 0) + coalesce(pg_column_size(joint_feedback), 0)
         + coalesce(pg_column_size(skeleton), 0) < 65536)
);
create index if not exists coach_student_analyses_folder_idx
  on public.coach_student_analyses (coach_id, student_id, created_at desc);
alter table public.coach_student_analyses enable row level security;

drop policy if exists "coach reads own student analyses"   on public.coach_student_analyses;
drop policy if exists "coach files student analyses"       on public.coach_student_analyses;
drop policy if exists "coach edits own student analyses"   on public.coach_student_analyses;
drop policy if exists "coach deletes own student analyses" on public.coach_student_analyses;
create policy "coach reads own student analyses" on public.coach_student_analyses for select
  using (auth.uid() = coach_id);
create policy "coach files student analyses" on public.coach_student_analyses for insert
  with check (auth.uid() = coach_id and public.is_coach() and public.consent_ok());
create policy "coach edits own student analyses" on public.coach_student_analyses for update
  using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id and public.is_coach() and public.consent_ok());
create policy "coach deletes own student analyses" on public.coach_student_analyses for delete
  using (auth.uid() = coach_id);

-- ---------------------------------------------------------------------------
-- 3. Size limits per coach
-- ---------------------------------------------------------------------------
create or replace function public.enforce_coach_student_limits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'coach_students' then
    if (select count(*) from public.coach_students where coach_id = new.coach_id) >= 500 then
      raise exception 'student folder limit reached' using errcode = '54000';
    end if;
  elsif (select count(*) from public.coach_student_analyses where coach_id = new.coach_id) >= 10000 then
    raise exception 'student analysis limit reached' using errcode = '54000';
  end if;
  return new;
end;
$$;
drop trigger if exists coach_students_limit on public.coach_students;
create trigger coach_students_limit before insert on public.coach_students
  for each row execute function public.enforce_coach_student_limits();
drop trigger if exists coach_student_analyses_limit on public.coach_student_analyses;
create trigger coach_student_analyses_limit before insert on public.coach_student_analyses
  for each row execute function public.enforce_coach_student_limits();

-- ---------------------------------------------------------------------------
-- 4. Re-filing between the coach's own history and a student folder
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER: both halves run under the caller's RLS, so a coach can only
-- move their own rows into their own folders. Insert + delete happen in one
-- transaction, so a clip is never lost or duplicated by a half-finished move.

create or replace function public.move_session_to_student(p_session_id uuid, p_student_id uuid)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  insert into public.coach_student_analyses
    (coach_id, student_id, created_at, stroke, form_score, serve_speed, flaws, joint_feedback)
  select auth.uid(), p_student_id, s.created_at, s.stroke, s.form_score, s.serve_speed, s.flaws, s.joint_feedback
    from public.sessions s
   where s.id = p_session_id and s.user_id = auth.uid()
  returning id into v_id;
  if v_id is null then return null; end if;
  delete from public.sessions where id = p_session_id and user_id = auth.uid();
  return v_id;
end;
$$;
revoke all on function public.move_session_to_student(uuid, uuid) from public, anon;
grant execute on function public.move_session_to_student(uuid, uuid) to authenticated;

create or replace function public.move_student_analysis_to_me(p_analysis_id uuid)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  insert into public.sessions
    (user_id, created_at, stroke, form_score, serve_speed, flaws, joint_feedback)
  select auth.uid(), a.created_at, a.stroke, a.form_score, a.serve_speed, a.flaws, a.joint_feedback
    from public.coach_student_analyses a
   where a.id = p_analysis_id and a.coach_id = auth.uid()
  returning id into v_id;
  if v_id is null then return null; end if;
  delete from public.coach_student_analyses where id = p_analysis_id and coach_id = auth.uid();
  return v_id;
end;
$$;
revoke all on function public.move_student_analysis_to_me(uuid) from public, anon;
grant execute on function public.move_student_analysis_to_me(uuid) to authenticated;
