-- ============================================================================
-- account_count(): total number of registered accounts.
--
-- Run once in the Supabase SQL editor. Used by the /api/analytics/stats route
-- (service role) to add "accounts made" to the live "athletes served" figure.
--
-- SECURITY DEFINER so it can read auth.users (which isn't exposed via the REST
-- API). It returns ONLY an aggregate count — never any user data — and execute
-- is granted solely to the service_role, so the anon/authenticated clients can't
-- call it. The route already runs with the service role.
-- ============================================================================
create or replace function public.account_count()
returns bigint
language sql
security definer
set search_path = auth, public
stable
as $$
  select count(*) from auth.users;
$$;

revoke all on function public.account_count() from public;
grant execute on function public.account_count() to service_role;
