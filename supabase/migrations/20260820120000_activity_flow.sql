-- Record what the learner actually practised, not just how their attempts were
-- typed in.
--
-- Until now a session row only existed when an attempt was scored, because
-- ProgressService opened one lazily from record(). Listening and shadowing
-- score nothing, so they left no trace at all - and practice_sessions.mode
-- ('speech' | 'typing') could not have told them apart anyway. The suggestion
-- engine needs both facts, so the activity becomes a first-class column and
-- the client opens the session when the activity starts.

create type public.practice_activity as enum (
  'listening', 'shadowing', 'speaking', 'spelling'
);

-- Added nullable so existing rows can be backfilled before the constraint
-- lands. Every historical session was scored, or it would not exist.
alter table public.practice_sessions
  add column activity public.practice_activity;

update public.practice_sessions
   set activity = case mode
                    when 'typing' then 'spelling'::public.practice_activity
                    else 'speaking'::public.practice_activity
                  end
 where activity is null;

alter table public.practice_sessions
  alter column activity set not null;

-- mode is now derivable from activity, and two columns that say nearly the
-- same thing drift apart. sentence_attempts.mode stays: there it describes how
-- one attempt was entered, which is a different fact about a different row.
alter table public.practice_sessions
  drop column mode;

create index practice_sessions_user_activity_idx
  on public.practice_sessions (user_id, activity, deck_id);

comment on column public.practice_sessions.activity is
  'What the learner practised. Recorded for every session, including the '
  'unscored ones, because the suggestion engine reads it.';

-- The topic stopped being a setting. It is chosen per session on the chooser
-- screen and already lives on practice_sessions.deck_id; keeping a second copy
-- in user_settings would only invite the two to disagree. level_id stays - it
-- is the profile fact this release finally starts using.
alter table public.user_settings
  drop column topic_id;
