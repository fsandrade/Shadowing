-- Totals for the two panels on the chooser screen: what the learner has done
-- all along, and what they have done today.
--
-- The rule these encode, decided at the product level: days and minutes count
-- every activity, sentences count only the scored ones. Listening has no
-- sentence to score but it is still practice, so a week of it must show a week
-- of days rather than an empty panel - while "sentences" stays a statement
-- about work that was actually marked. The UI labels the sentence figures
-- "scored" so the two scopes cannot be mistaken for each other.

-- --------------------------------------------------------------- practice time

-- elapsed_ms is wall-clock: how long the session was open, pauses and forgotten
-- tabs included. That is the wrong number for "minutes studied", and the client
-- has always known the right one - the countdown it actually consumed - without
-- ever sending it.
--
-- Both are kept, and the duplication is deliberate here: the difference between
-- them is idle time, which is the only signal that separates a session someone
-- worked through from one they walked away from.
alter table public.practice_sessions
  add column practised_ms integer not null default 0;

alter table public.practice_sessions
  add constraint practice_sessions_practised_not_negative check (practised_ms >= 0);

comment on column public.practice_sessions.practised_ms is
  'Time the audio was actually running, as the client''s own timer measured '
  'it. Compare with elapsed_ms to find sessions that were abandoned.';

-- ------------------------------------------------------------------- local day

-- The learner's own calendar day. Takes the zone as an argument rather than
-- looking it up, so it needs no elevated rights and the caller's RLS still
-- decides which profiles are visible. An unrecognised zone raises rather than
-- returning null, so the fallback is a real exception handler - without it one
-- bad profile row would break every view below for everyone.
create or replace function public.day_in_zone(p_at timestamptz, p_zone text)
returns date
language plpgsql
stable
set search_path = ''
as $$
begin
  return (p_at at time zone coalesce(p_zone, 'UTC'))::date;
exception when others then
  return (p_at at time zone 'UTC')::date;
end;
$$;

-- ---------------------------------------------------------------- streaks

-- Rewritten to count days from sessions rather than from scored attempts.
--
-- This changes behaviour that already shipped: a learner who only ever does
-- Listening had a permanent streak of zero, because user_daily_activity is
-- only written by record_sentence_attempt(). Sessions cover strictly more
-- ground - every attempt belongs to one, enforced by the foreign key - so
-- nothing that used to count stops counting.
--
-- practised_ms > 0 is the bar for "studied": starting an activity and never
-- pressing play is not a day of practice.
create or replace view public.user_streaks with (security_invoker = true) as
with practised as (
  select distinct
    s.user_id,
    public.day_in_zone(s.started_at, p.time_zone) as day
  from public.practice_sessions s
  join public.profiles p on p.id = s.user_id
  where s.practised_ms > 0
),
numbered as (
  select
    user_id,
    day,
    day - (row_number() over (partition by user_id order by day))::integer as run_key
  from practised
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
  'Consecutive days with at least one practised session. The current streak '
  'counts a run ending today or yesterday; the one-day grace absorbs the gap '
  'between the server date and the learner''s own time zone.';

-- ----------------------------------------------------------------- totals

create view public.user_practice_totals with (security_invoker = true) as
with zone as (
  select p.id as user_id, coalesce(p.time_zone, 'UTC') as tz
  from public.profiles p
),
sessions_by_day as (
  select
    s.user_id,
    public.day_in_zone(s.started_at, z.tz) as day,
    sum(s.practised_ms)                    as practised_ms
  from public.practice_sessions s
  join zone z on z.user_id = s.user_id
  where s.practised_ms > 0
  group by 1, 2
),
attempts_by_day as (
  select
    a.user_id,
    public.day_in_zone(a.attempted_at, z.tz) as day,
    count(*)                                 as attempts,
    count(distinct a.sentence_id)            as distinct_sentences,
    coalesce(sum(a.stars), 0)                as stars
  from public.sentence_attempts a
  join zone z on z.user_id = a.user_id
  group by 1, 2
)
select
  z.user_id,

  coalesce(st.current_streak, 0) as current_streak,
  coalesce(st.longest_streak, 0) as longest_streak,

  coalesce((select count(*) from sessions_by_day d
             where d.user_id = z.user_id), 0)              as days_studied,
  coalesce((select sum(d.practised_ms) from sessions_by_day d
             where d.user_id = z.user_id), 0)              as practised_ms,
  coalesce((select sum(d.attempts) from attempts_by_day d
             where d.user_id = z.user_id), 0)              as sentences_practised,
  coalesce((select count(*) from public.user_sentence_progress u
             where u.user_id = z.user_id), 0)              as sentences_distinct,
  coalesce((select sum(d.stars) from attempts_by_day d
             where d.user_id = z.user_id), 0)              as stars_earned,

  coalesce((select sum(d.practised_ms) from sessions_by_day d
             where d.user_id = z.user_id
               and d.day = public.day_in_zone(now(), z.tz)), 0) as today_practised_ms,
  coalesce((select sum(d.attempts) from attempts_by_day d
             where d.user_id = z.user_id
               and d.day = public.day_in_zone(now(), z.tz)), 0) as today_sentences_practised,
  -- Summed over a single day, so this really is a distinct count.
  coalesce((select sum(d.distinct_sentences) from attempts_by_day d
             where d.user_id = z.user_id
               and d.day = public.day_in_zone(now(), z.tz)), 0) as today_sentences_distinct,
  coalesce((select sum(d.stars) from attempts_by_day d
             where d.user_id = z.user_id
               and d.day = public.day_in_zone(now(), z.tz)), 0) as today_stars_earned

from zone z
left join public.user_streaks st on st.user_id = z.user_id;

comment on view public.user_practice_totals is
  'One row per learner for the chooser screen''s panels. Days and minutes '
  'count every activity; sentence and star figures count only scored '
  'attempts, because unscored practice produces none.';

grant select on public.user_practice_totals to authenticated;
