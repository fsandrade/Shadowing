-- Reduce table privileges to what each role actually needs.
--
-- Supabase applies default privileges that grant anon and authenticated the
-- full set - SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER - on
-- every new table in `public`. The earlier migrations' `grant select, insert`
-- statements were therefore no-ops: they added nothing that was not already
-- there.
--
-- Nothing was ever exposed by this. RLS refuses any command that has no
-- matching policy, so the writes those grants permitted were all rejected a
-- layer later. But it left RLS as the only thing standing between a client and
-- the teaching content, and it made the comments in those migrations untrue.
-- One over-broad policy added later, by anyone, and there would have been
-- nothing behind it.
--
-- So: revoke everything, then grant back precisely the verbs each role uses.
--
-- Note this does not change the project's default privileges, only these
-- tables. Any table added later starts wide open again. If that is not wanted:
--   alter default privileges in schema public
--     revoke insert, update, delete, truncate on tables from anon, authenticated;

-- Content: readable by everyone, writable by no client. -------------------
revoke all on public.levels    from anon, authenticated;
revoke all on public.decks     from anon, authenticated;
revoke all on public.sentences from anon, authenticated;

grant select on public.levels, public.decks, public.sentences to anon, authenticated;

-- Owned by a user: no anon access at all. --------------------------------
revoke all on public.profiles      from anon, authenticated;
revoke all on public.user_settings from anon, authenticated;

grant select, insert, update on public.profiles, public.user_settings to authenticated;

-- Practice. Sessions are updatable so a client can close one out; neither
-- table is deletable, because removing history would strand the rollups it
-- already fed. --------------------------------------------------------------
revoke all on public.practice_sessions from anon, authenticated;
revoke all on public.sentence_attempts from anon, authenticated;

grant select, insert, update on public.practice_sessions to authenticated;
grant select, insert on public.sentence_attempts to authenticated;

-- Rollups: derived data. Readable only; record_sentence_attempt() owns every
-- write and runs as SECURITY DEFINER, so it is unaffected by these grants. ---
revoke all on public.user_sentence_progress from anon, authenticated;
revoke all on public.user_daily_activity    from anon, authenticated;

grant select on public.user_sentence_progress, public.user_daily_activity
  to authenticated;

-- Views. security_invoker already applies the caller's RLS; this stops anon
-- reaching them at all. -----------------------------------------------------
revoke all on public.user_deck_progress     from anon, authenticated;
revoke all on public.user_level_progress    from anon, authenticated;
revoke all on public.user_streaks           from anon, authenticated;
revoke all on public.user_progress_summary  from anon, authenticated;

grant select on
  public.user_deck_progress,
  public.user_level_progress,
  public.user_streaks,
  public.user_progress_summary
  to authenticated;

-- Foreign keys without a covering index, flagged by the performance linter.
-- Both matter on cascade: deleting a sentence or a deck has to scan these.
create index practice_sessions_deck_idx
  on public.practice_sessions (deck_id);
create index user_sentence_progress_sentence_idx
  on public.user_sentence_progress (sentence_id);
