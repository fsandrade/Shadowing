-- Hardening pass, prompted by the Supabase database linter.
--
-- Two findings, both real:
--
-- 1. set_updated_at() had no fixed search_path, so it resolved unqualified
--    names against whatever the caller's search_path happened to be
--    (0011_function_search_path_mutable).
--
-- 2. Postgres grants EXECUTE on new functions to PUBLIC, and anon and
--    authenticated inherit it. That published every SECURITY DEFINER trigger
--    function as a REST endpoint at /rest/v1/rpc/<name>
--    (0028 / 0029_*_security_definer_function_executable).
--
--    Postgres refuses to run a trigger function called directly, so these were
--    not exploitable - but they had no business being reachable, and relying on
--    that refusal is a thin defence to leave in place deliberately.
--
-- Revoking EXECUTE does not stop the triggers firing: permissions on a trigger
-- function are checked when the trigger is created, not each time it runs.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.sync_profile_is_anonymous() from public, anon, authenticated;
revoke all on function public.record_sentence_attempt() from public, anon, authenticated;
