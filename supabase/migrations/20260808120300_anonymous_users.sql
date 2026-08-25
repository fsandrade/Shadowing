-- Anonymous learners.
--
-- Unregistered visitors get a real auth user via supabase.auth.signInAnonymously().
-- That gives them a genuine JWT, so they carry the 'authenticated' role and every
-- policy in the previous migration already applies to them as written - no
-- separate code path, and progress is tracked exactly as it is for a registered
-- learner.
--
-- It also means signing up costs nothing: linking an identity to an anonymous
-- user keeps the same auth.users.id, so all the progress hanging off that id
-- carries over with no migration step.
--
-- Registration is Google SSO, so the conversion call is
-- linkIdentity({ provider: 'google' }) rather than updateUser({ email }).
--
-- There is deliberately no merge path. If that Google account already belongs
-- to another user, linkIdentity fails and the client falls back to a plain
-- signInWithOAuth, landing the learner on their existing account; the
-- anonymous progress is discarded. The unregistered experience is a sandbox
-- meant to demonstrate tracking and prompt a signup, not a second store of
-- record worth reconciling. So the common case (a Google account not yet seen)
-- keeps everything, the collision case keeps nothing, and neither one needs
-- server-side merge logic.
--
-- Nothing here restricts what an anonymous learner can do. If you ever want to,
-- add a restrictive policy keyed on the JWT claim rather than a new role:
--
--   create policy "..." on public.some_table as restrictive for insert
--     to authenticated
--     with check ((select (auth.jwt() ->> 'is_anonymous')::boolean) is false);

alter table public.profiles
  add column is_anonymous boolean not null default false;

comment on column public.profiles.is_anonymous is
  'Mirrors auth.users.is_anonymous. Flips to false automatically when the '
  'learner registers, because the user id does not change on conversion.';

-- Now also records whether the new user is anonymous.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Providers disagree on the key: Google sends both 'full_name' and 'name',
  -- others send only one. Anonymous users send neither, and NULL is correct
  -- for them.
  insert into public.profiles (id, display_name, is_anonymous)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    coalesce(new.is_anonymous, false)
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Registration flips auth.users.is_anonymous to false in place. Without this
-- the profile copy would still claim the learner is anonymous forever, and the
-- cleanup job below would eventually delete a paying customer's progress.
create or replace function public.sync_profile_is_anonymous()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles p
     set is_anonymous = coalesce(new.is_anonymous, false)
   where p.id = new.id
     and p.is_anonymous is distinct from coalesce(new.is_anonymous, false);
  return new;
end;
$$;

create trigger on_auth_user_anonymity_changed
  after update of is_anonymous on auth.users
  for each row execute function public.sync_profile_is_anonymous();

-- Everything a "you have progress worth keeping - create an account" prompt
-- needs, in one row. security_invoker means a learner only ever sees their own.
create view public.user_progress_summary with (security_invoker = true) as
select
  p.id                                   as user_id,
  p.is_anonymous,
  count(usp.sentence_id)                 as sentences_attempted,
  count(usp.mastered_at)                 as sentences_mastered,
  coalesce(sum(usp.total_stars), 0)      as stars_earned,
  coalesce(max(st.current_streak), 0)    as current_streak,
  coalesce(max(st.longest_streak), 0)    as longest_streak,
  max(usp.last_attempt_at)               as last_attempt_at
from public.profiles p
left join public.user_sentence_progress usp on usp.user_id = p.id
left join public.user_streaks st on st.user_id = p.id
group by p.id, p.is_anonymous;

grant select on public.user_progress_summary to authenticated;

-- Anonymous users accumulate forever otherwise: every fresh browser that never
-- signs up leaves a row behind.
--
-- Deliberately keyed on last activity rather than on created_at alone, which is
-- what the Supabase docs' one-liner does. Someone who has practised daily for
-- six weeks without registering is exactly the learner worth keeping, and
-- created_at alone would delete them mid-streak.
--
-- Deleting the auth user cascades away their profile, settings, sessions,
-- attempts and rollups. Not exposed to clients; call it as service_role, or
-- schedule it with pg_cron:
--
--   select cron.schedule('purge-anonymous', '0 3 * * *',
--     $cron$ select public.delete_stale_anonymous_users() $cron$);
create or replace function public.delete_stale_anonymous_users(
  inactive_for interval default interval '30 days'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff  timestamptz := now() - inactive_for;
  v_deleted integer;
begin
  with doomed as (
    select u.id
      from auth.users u
     where u.is_anonymous is true
       and u.created_at < v_cutoff
       and coalesce(
             (select max(a.attempted_at)
                from public.sentence_attempts a
               where a.user_id = u.id),
             u.created_at
           ) < v_cutoff
  )
  delete from auth.users u
   using doomed d
   where u.id = d.id;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.delete_stale_anonymous_users(interval)
  from public, anon, authenticated;
