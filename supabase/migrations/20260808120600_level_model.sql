-- Give every sentence a real level, and reshape user_settings to match the
-- product model: a learner picks a level first, then optionally narrows to one
-- topic.
--
-- Levels are assigned per topic rather than per sentence. A topic holds a
-- fairly coherent register - Groceries is not Job Interview - so 24 judgements
-- land far closer than 2242 guesses would, and each one is a single UPDATE to
-- revise. It is still coarse: a hard sentence can sit inside an easy topic.
--
-- No topic is C2. This corpus is idiomatic everyday English; the hardest of it
-- is the discourse glue ("as far as I'm concerned", "don't get me wrong"),
-- which is C1. Rather than inflate a topic to fill the slot, C2 is left empty
-- and the level picker shows it as unavailable. Move a topic into it here if
-- you disagree.

update public.sentences s
   set level_id = m.level_id
  from (values
    -- A1: concrete, high-frequency, minimal idiom.
    ('groceries-supermarket',            'A1'),
    ('weather-seasons',                  'A1'),

    -- A2: everyday routine and transactional situations.
    ('daily-life',                       'A2'),
    ('small-talk',                       'A2'),
    ('making-plans',                     'A2'),
    ('travel',                           'A2'),
    ('restaurants',                      'A2'),
    ('shopping',                         'A2'),
    ('directions-transport',             'A2'),

    -- B1: familiar topics needing opinion and description.
    ('socializing',                      'B1'),
    ('emotions-opinions',                'B1'),
    ('gym-fitness',                      'B1'),
    ('doctor-health',                    'B1'),
    ('hobbies-free-time',                'B1'),
    ('banking-money',                    'B1'),
    ('customer-service',                 'B1'),
    ('school-learning',                  'B1'),

    -- B2: professional register and abstract negotiation.
    ('work-office',                      'B2'),
    ('meetings',                         'B2'),
    ('problem-solving',                  'B2'),
    ('job-interview',                    'B2'),
    ('renting-housing',                  'B2'),

    -- C1: discourse markers and dense domain jargon.
    ('native-fillers-conversation-glue', 'C1'),
    ('tech-software-development',        'C1')
  ) as m(deck_id, level_id)
 where s.deck_id = m.deck_id;

-- Every sentence must have landed somewhere; a topic added later without an
-- entry above would otherwise sit silently at the old placeholder.
do $$
declare stragglers integer;
begin
  select count(distinct deck_id) into stragglers
    from public.sentences
   where level_id not in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');
  if stragglers > 0 then
    raise exception '% topic(s) were not assigned a level', stragglers;
  end if;
end $$;

-- user_settings described the old model, where a "deck" could also mean the
-- pseudo-selections 'all' and 'custom'. The selection is now two independent
-- things, and both are real references.
alter table public.user_settings
  drop column deck_selection;

alter table public.user_settings
  -- NULL until the learner picks one on first run.
  add column level_id text references public.levels (id) on update cascade,
  -- NULL means every topic at that level, which is the default.
  add column topic_id text references public.decks (id) on update cascade;
