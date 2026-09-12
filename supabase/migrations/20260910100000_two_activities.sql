-- Two activities: Speaking (scored by voice) and Dictation (scored by typing).
-- New enum, backfill, swap, drop the old one (Postgres cannot remove a value).
create type public.practice_activity_new as enum ('speaking', 'dictation');

alter table public.practice_sessions
  add column activity_new public.practice_activity_new;

update public.practice_sessions
   set activity_new = case
     when activity in ('listening', 'shadowing', 'speaking') then 'speaking'::public.practice_activity_new
     else 'dictation'::public.practice_activity_new
   end;

alter table public.practice_sessions
  drop column activity;

alter table public.practice_sessions
  rename column activity_new to activity;

alter table public.practice_sessions
  alter column activity set not null;

drop type public.practice_activity;

-- The blur and repeat-until-five settings no longer exist in the app.
alter table public.user_settings
  drop column if exists blur,
  drop column if exists repeat_until_five;

create index practice_sessions_user_activity_idx
  on public.practice_sessions (user_id, activity, deck_id);
