-- Teaching content: levels, decks and sentences.
--
-- This content is identical for every user. Nobody authors it through the app,
-- so there are no ownership columns and no client write policies. It is loaded
-- by supabase/seed.sql, which runs as the service role.

-- CEFR levels. The ids sort correctly as plain text (A1 < A2 < B1 < ... < C2),
-- so no separate ordering column is needed.
create table public.levels (
  id          text primary key,
  description text not null,

  constraint levels_id_is_cefr check (id ~ '^[ABC][12]$'),
  constraint levels_description_not_blank check (length(btrim(description)) > 0)
);

create table public.decks (
  id          text    primary key,
  description text    not null,
  -- The topic order is curated, not alphabetical, and rows have no inherent
  -- order in Postgres. Without this the topic list comes back in whatever
  -- order the planner produces.
  position    integer not null,

  constraint decks_id_is_slug check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint decks_description_not_blank check (length(btrim(description)) > 0),
  constraint decks_position_not_negative check (position >= 0),
  -- Deferred, because reordering swaps positions between rows and a per-row
  -- check would reject the intermediate state mid-statement.
  constraint decks_position_key unique (position) deferrable initially deferred
);

create table public.sentences (
  id       uuid    primary key,
  deck_id  text    not null references public.decks (id) on update cascade,
  -- Stored ready to display, markup and all. The schema treats it as opaque
  -- text: whatever highlighting the app wants to render is the app's business.
  content  text    not null,
  level_id text    not null references public.levels (id) on update cascade,
  -- Order is content here: the corpus keeps the sentences that drill one idiom
  -- next to each other, and they read as a progression.
  position integer not null,

  constraint sentences_content_not_blank check (length(btrim(content)) > 0),
  constraint sentences_position_not_negative check (position >= 0),
  -- Deferred for the same reason as decks: adding one sentence renumbers every
  -- sentence after it, and those updates land one row at a time.
  constraint sentences_deck_position_key unique (deck_id, position)
    deferrable initially deferred
);

create index sentences_level_idx on public.sentences (level_id);

comment on table public.sentences is
  'Practice sentences. "content" is stored ready to display; any highlight '
  'markup inside it is opaque to the database.';
