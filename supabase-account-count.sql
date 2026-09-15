-- ============================================================================
-- account_count(): number of EMAIL-CONFIRMED accounts.
--
-- Run (or re-run) in the Supabase SQL editor. Used by the /api/analytics/stats
-- route (service role) to add "accounts made" to the live "athletes served".
--
-- Counts only accounts whose email is confirmed (email_confirmed_at is set), so
-- the figure reflects real, verified people — not unconfirmed or throwaway
-- signups that never clicked the confirmation link. This is the most defensible
-- "real humans" number we have, because faking it at scale needs real inboxes.
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
  select count(*) from auth.users where email_confirmed_at is not null;
$$;

revoke all on function public.account_count() from public;
grant execute on function public.account_count() to service_role;
