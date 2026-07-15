-- Repairs squad creation on Supabase projects where pgcrypto functions live
-- in the extensions schema. Run after supabase-complete-app.sql.

create or replace function public.create_my_squad(p_name text default 'My squad')
returns table (squad_id uuid, squad_name text, squad_code text)
language plpgsql security definer set search_path = public as $$
declare v_code text; v_id uuid; v_name text;
begin
  if not exists (
    select 1 from public.account_roles
    where user_id = auth.uid() and role = 'coach'
  ) then
    raise exception 'coach account required' using errcode = '42501';
  end if;

  v_name := left(coalesce(nullif(trim(p_name), ''), 'My squad'), 60);
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.squads where code = v_code);
  end loop;

  insert into public.squads(coach_id, code, name)
    values (auth.uid(), v_code, v_name)
    returning id into v_id;
  return query select v_id, v_name, v_code;
end;
$$;

revoke all on function public.create_my_squad(text) from public;
grant execute on function public.create_my_squad(text) to authenticated;
