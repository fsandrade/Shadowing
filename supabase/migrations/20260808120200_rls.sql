-- Row Level Security.
--
-- Two rules shape everything below.
--
-- 1. Teaching content is world-readable and client-unwritable. It is the same
--    for every user, so clients get SELECT and nothing else. The seed runs as
--    service_role, which bypasses RLS.
--
-- 2. Anything a trigger maintains is read-only to clients. sentence_attempts is
--    insert-only, and the rollup tables take no client writes at all. This is
--    not defensiveness for its own sake: record_sentence_attempt() fires on
--    INSERT, so an UPDATE or DELETE that clients could perform would move the
--    history without moving the statistics derived from it, and nothing would
--    ever reconcile the two. Correcting history is a service_role job.

-- ---------------------------------------------------------------- content

alter table public.levels    enable row level security;
alter table public.decks     enable row level security;
alter table public.sentences enable row level security;

create policy "Content is readable by everyone"
  on public.levels for select to anon, authenticated using (true);

create policy "Content is readable by everyone"
  on public.decks for select to anon, authenticated using (true);

create policy "Content is readable by everyone"
  on public.sentences for select to anon, authenticated using (true);

grant select on public.levels, public.decks, public.sentences to anon, authenticated;

-- --------------------------------------------------------- owned by a user

alter table public.profiles      enable row level security;
alter table public.user_settings enable row level security;

create policy "Read own profile"
  on public.profiles for select to authenticated using ((select auth.uid()) = id);

create policy "Create own profile"
  on public.profiles for insert to authenticated with check ((select auth.uid()) = id);

create policy "Update own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Read own settings"
  on public.user_settings for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Create own settings"
  on public.user_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Update own settings"
  on public.user_settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.profiles, public.user_settings to authenticated;

-- ---------------------------------------------------------------- practice

alter table public.practice_sessions  enable row level security;
alter table public.sentence_attempts  enable row level security;

-- Sessions are updatable so the client can close one out with ended_at and
-- elapsed_ms. Not deletable: removing a session cascades its attempts away
-- while the rollups they fed stay behind.
create policy "Read own sessions"
  on public.practice_sessions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Start own sessions"
  on public.practice_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Update own sessions"
  on public.practice_sessions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Read own attempts"
  on public.sentence_attempts for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Record own attempts"
  on public.sentence_attempts for insert to authenticated
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.practice_sessions to authenticated;
grant select, insert on public.sentence_attempts to authenticated;

-- ---------------------------------------------------------------- rollups
--
-- Derived data. Readable, never client-writable; record_sentence_attempt()
-- owns every write and runs as SECURITY DEFINER to get past these policies.

alter table public.user_sentence_progress enable row level security;
alter table public.user_daily_activity    enable row level security;

create policy "Read own sentence progress"
  on public.user_sentence_progress for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Read own daily activity"
  on public.user_daily_activity for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.user_sentence_progress, public.user_daily_activity
  to authenticated;

grant select on
  public.user_deck_progress,
  public.user_level_progress,
  public.user_streaks
  to authenticated;
