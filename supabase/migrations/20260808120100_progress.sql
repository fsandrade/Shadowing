-- User progress: profiles, settings, sessions, attempts and their rollups.
--
-- The app writes two things: a session row, and one row per completed attempt.
-- Everything else in here - best stars, mastery, streaks, session tallies - is
-- maintained by a trigger, so a client cannot drift out of sync with its own
-- statistics.
--
-- Practice on the "My text" feature is deliberately absent. That content lives
-- only in the browser, so it is never recorded and never counts toward
-- progress. sentence_attempts.sentence_id is NOT NULL, which makes that
-- structural rather than a rule the client has to remember.

create type public.practice_mode as enum ('speech', 'typing');

-- Only terminal outcomes are stored. The app's transient 'listening' and
-- 'typing' states never reach the database.
create type public.attempt_status as enum ('scored', 'failed');

-- --------------------------------------------------------------- profiles

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  -- Streaks are counted in the learner's own day, not the server's. Without
  -- this a session at 11pm lands on tomorrow's date for anyone west of UTC and
  -- silently splits their streak in two.
  time_zone    text        not null default 'UTC',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Deliberately only a non-blank check. An unrecognised zone name raises
  -- rather than returning NULL, so validating it here would turn a bad profile
  -- update into a hard error; record_sentence_attempt() falls back to UTC.
  constraint profiles_time_zone_not_blank check (length(btrim(time_zone)) > 0)
);

create table public.user_settings (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  -- Plain text, not a foreign key: 'all' and 'custom' are valid selections in
  -- the UI but are not decks, and inventing pseudo-deck rows to satisfy a
  -- constraint would put them in everyone's topic list.
  deck_selection    text          not null default 'all',
  rate              numeric(3, 2) not null default 1,
  slack             numeric(3, 2) not null default 1,
  voice_name        text          not null default '',
  duration_min      smallint      not null default 0,
  blur              boolean       not null default false,
  stt_enabled       boolean       not null default false,
  repeat_until_five boolean       not null default false,
  typing_mode       boolean       not null default false,
  updated_at        timestamptz   not null default now(),

  constraint user_settings_deck_selection_not_blank
    check (length(btrim(deck_selection)) > 0),
  constraint user_settings_rate_in_range check (rate > 0 and rate <= 3),
  constraint user_settings_slack_in_range check (slack >= 0 and slack <= 5),
  constraint user_settings_duration_not_negative check (duration_min >= 0)
);

-- --------------------------------------------------------------- practice

create table public.practice_sessions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  -- NULL means the "All" selection, which spans every deck. Sessions on the
  -- "My text" feature are not recorded at all.
  deck_id              text references public.decks (id) on update cascade on delete set null,
  mode                 public.practice_mode not null,
  started_at           timestamptz not null default now(),
  ended_at             timestamptz,
  planned_duration_min smallint not null default 0,
  elapsed_ms           integer  not null default 0,
  -- Maintained by record_sentence_attempt(); clients should not write these.
  sentences_practiced  integer  not null default 0,
  stars_earned         integer  not null default 0,

  constraint practice_sessions_ends_after_start
    check (ended_at is null or ended_at >= started_at),
  constraint practice_sessions_elapsed_not_negative check (elapsed_ms >= 0),
  constraint practice_sessions_duration_not_negative check (planned_duration_min >= 0)
);

create index practice_sessions_user_started_idx
  on public.practice_sessions (user_id, started_at desc);

create table public.sentence_attempts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  session_id         uuid references public.practice_sessions (id) on delete cascade,
  sentence_id        uuid not null references public.sentences (id) on delete cascade,
  mode               public.practice_mode not null,
  status             public.attempt_status not null,
  stars              smallint,
  transcript         text,
  -- Word counts as the client's own tokenizer produced them. Recomputing these
  -- in SQL would give a different number: scoring spells out digits, drops
  -- apostrophes and canonicalises each word before it counts anything.
  target_word_count  smallint,
  matched_word_count smallint,
  similarity         real,
  attempted_at       timestamptz not null default now(),

  constraint sentence_attempts_stars_in_range
    check (stars is null or stars between 0 and 5),
  constraint sentence_attempts_scored_has_stars
    check (status <> 'scored' or stars is not null),
  constraint sentence_attempts_word_counts_not_negative
    check (coalesce(target_word_count, 0) >= 0 and coalesce(matched_word_count, 0) >= 0),
  constraint sentence_attempts_similarity_in_range
    check (similarity is null or (similarity >= 0 and similarity <= 1))
);

create index sentence_attempts_user_time_idx
  on public.sentence_attempts (user_id, attempted_at desc);
create index sentence_attempts_session_idx on public.sentence_attempts (session_id);
create index sentence_attempts_sentence_idx on public.sentence_attempts (sentence_id);

comment on table public.sentence_attempts is
  'One row per completed attempt. The append-only history behind every rollup.';

-- ---------------------------------------------------------------- rollups

create table public.user_sentence_progress (
  user_id          uuid not null references auth.users (id) on delete cascade,
  sentence_id      uuid not null references public.sentences (id) on delete cascade,
  attempts         integer  not null default 0,
  scored_attempts  integer  not null default 0,
  best_stars       smallint not null default 0,
  last_stars       smallint,
  total_stars      integer  not null default 0,
  first_attempt_at timestamptz not null default now(),
  last_attempt_at  timestamptz not null default now(),
  -- Set on the first five-star attempt, which the app awards only for a
  -- word-for-word match. Never cleared by a later worse attempt.
  mastered_at      timestamptz,

  primary key (user_id, sentence_id)
);

create index user_sentence_progress_user_mastered_idx
  on public.user_sentence_progress (user_id, mastered_at);

create table public.user_daily_activity (
  user_id      uuid not null references auth.users (id) on delete cascade,
  -- The learner's local day, resolved through profiles.time_zone.
  day          date not null,
  attempts     integer not null default 0,
  stars_earned integer not null default 0,

  primary key (user_id, day)
);

-- --------------------------------------------------------------- triggers

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- Give every new auth user a profile and a settings row so the app never has
-- to branch on "first login".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Folds one attempt into every rollup that depends on it.
--
-- SECURITY DEFINER so the rollups stay authoritative even though RLS hides
-- other users' rows. This is safe because it only ever writes rows keyed to
-- NEW.user_id, and the insert policy on sentence_attempts already pins that
-- column to auth.uid().
create or replace function public.record_sentence_attempt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stars     smallint := coalesce(new.stars, 0);
  v_scored    integer  := case when new.status = 'scored' then 1 else 0 end;
  v_mastered  timestamptz := case when new.stars = 5 then new.attempted_at end;
  v_time_zone text;
  v_day       date;
begin
  select coalesce(p.time_zone, 'UTC') into v_time_zone
    from public.profiles p
   where p.id = new.user_id;

  begin
    v_day := (new.attempted_at at time zone coalesce(v_time_zone, 'UTC'))::date;
  exception when others then
    -- An unrecognised zone must not cost the learner their attempt.
    v_day := (new.attempted_at at time zone 'UTC')::date;
  end;

  insert into public.user_sentence_progress as usp (
    user_id, sentence_id, attempts, scored_attempts, best_stars, last_stars,
    total_stars, first_attempt_at, last_attempt_at, mastered_at
  )
  values (
    new.user_id, new.sentence_id, 1, v_scored, v_stars, new.stars,
    v_stars, new.attempted_at, new.attempted_at, v_mastered
  )
  on conflict (user_id, sentence_id) do update set
    attempts         = usp.attempts + 1,
    scored_attempts  = usp.scored_attempts + v_scored,
    best_stars       = greatest(usp.best_stars, v_stars),
    last_stars       = new.stars,
    total_stars      = usp.total_stars + v_stars,
    first_attempt_at = least(usp.first_attempt_at, new.attempted_at),
    last_attempt_at  = greatest(usp.last_attempt_at, new.attempted_at),
    mastered_at      = coalesce(usp.mastered_at, v_mastered);

  insert into public.user_daily_activity as uda (user_id, day, attempts, stars_earned)
  values (new.user_id, v_day, 1, v_stars)
  on conflict (user_id, day) do update set
    attempts     = uda.attempts + 1,
    stars_earned = uda.stars_earned + v_stars;

  if new.session_id is not null then
    update public.practice_sessions s
       set sentences_practiced = (
             select count(distinct a.sentence_id)
               from public.sentence_attempts a
              where a.session_id = new.session_id
           ),
           stars_earned = (
             select coalesce(sum(coalesce(a.stars, 0)), 0)
               from public.sentence_attempts a
              where a.session_id = new.session_id
           )
     where s.id = new.session_id;
  end if;

  return new;
end;
$$;

create trigger sentence_attempts_record
  after insert on public.sentence_attempts
  for each row execute function public.record_sentence_attempt();

-- ------------------------------------------------------------------ views
--
-- security_invoker so the caller's RLS policies apply. Without it a view owned
-- by the migration role would happily return every user's rows.

create view public.user_deck_progress with (security_invoker = true) as
select
  usp.user_id,
  s.deck_id,
  (select count(*) from public.sentences ds where ds.deck_id = s.deck_id) as sentences_total,
  count(*)                               as sentences_attempted,
  count(usp.mastered_at)                 as sentences_mastered,
  round(avg(usp.best_stars)::numeric, 2) as avg_best_stars,
  max(usp.last_attempt_at)               as last_attempt_at
from public.user_sentence_progress usp
join public.sentences s on s.id = usp.sentence_id
group by usp.user_id, s.deck_id;

create view public.user_level_progress with (security_invoker = true) as
select
  usp.user_id,
  s.level_id,
  (select count(*) from public.sentences ls where ls.level_id = s.level_id) as sentences_total,
  count(*)                               as sentences_attempted,
  count(usp.mastered_at)                 as sentences_mastered,
  round(avg(usp.best_stars)::numeric, 2) as avg_best_stars,
  max(usp.last_attempt_at)               as last_attempt_at
from public.user_sentence_progress usp
join public.sentences s on s.id = usp.sentence_id
group by usp.user_id, s.level_id;

-- Consecutive active days, found by the "date minus row number" trick: within
-- one unbroken run that difference is constant, so it groups the run.
create view public.user_streaks with (security_invoker = true) as
with numbered as (
  select
    user_id,
    day,
    day - (row_number() over (partition by user_id order by day))::integer as run_key
  from public.user_daily_activity
),
runs as (
  select
    user_id,
    max(day)      as ended_on,
    count(*)::int as length
  from numbered
  group by user_id, run_key
)
select
  user_id,
  max(length)                                                         as longest_streak,
  coalesce(max(length) filter (where ended_on >= current_date - 1), 0) as current_streak,
  max(ended_on)                                                       as last_active_on
from runs
group by user_id;

comment on view public.user_streaks is
  'Current streak counts a run ending today or yesterday. The one-day grace '
  'absorbs the gap between the server date and the learner''s own time zone.';
