-- ---------------------------------------------------------
-- Senses: one headword, several meanings.
--
-- A word like "account for" means 설명하다, 차지하다 and 원인이 되다, each with
-- its own synonyms and examples. Rating the headword as a whole would let a
-- meaning you know hide one you do not, so the sense becomes the unit that is
-- studied, examined and rated.
--
-- Existing rows are migrated, not discarded: every word becomes a word with
-- exactly one sense, and its synonyms, examples, questions and attempt history
-- are re-pointed at that sense.
-- ---------------------------------------------------------

create table if not exists senses (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references words(id) on delete cascade,
  meaning_ko text not null,
  test_point text,                        -- exam note for this meaning only
  difficulty_stars smallint not null default 3 check (difficulty_stars in (1, 2, 3)),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists senses_word_id_idx on senses(word_id);

-- Children move from the word to the sense. Nullable during the migration;
-- backfilled below and always written by the app afterwards.
alter table synonyms       add column if not exists sense_id uuid references senses(id) on delete cascade;
alter table examples       add column if not exists sense_id uuid references senses(id) on delete cascade;
alter table exam_questions add column if not exists sense_id uuid references senses(id) on delete cascade;
alter table exam_attempts  add column if not exists sense_id uuid references senses(id) on delete cascade;

-- The meaning, exam note and rating used to live on the word.
-- Keep the columns (dropping them would discard data that has not been copied
-- yet on a partially applied migration) but stop requiring them.
alter table words alter column meaning_ko drop not null;

-- One sense per pre-existing word, carrying its meaning and rating over.
insert into senses (word_id, meaning_ko, test_point, difficulty_stars, position)
select w.id, coalesce(w.meaning_ko, ''), w.test_point, coalesce(w.difficulty_stars, 3), 0
  from words w
 where not exists (select 1 from senses s where s.word_id = w.id);

-- Re-point the children at their word's first sense.
update synonyms c
   set sense_id = s.id
  from senses s
 where s.word_id = c.word_id and s.position = 0 and c.sense_id is null;

update examples c
   set sense_id = s.id
  from senses s
 where s.word_id = c.word_id and s.position = 0 and c.sense_id is null;

update exam_questions c
   set sense_id = s.id
  from senses s
 where s.word_id = c.word_id and s.position = 0 and c.sense_id is null;

update exam_attempts c
   set sense_id = s.id
  from senses s
 where s.word_id = c.word_id and s.position = 0 and c.sense_id is null;

create index if not exists synonyms_sense_id_idx on synonyms(sense_id);
create index if not exists examples_sense_id_idx on examples(sense_id);
create index if not exists exam_questions_sense_id_idx on exam_questions(sense_id);
create index if not exists exam_attempts_sense_id_idx on exam_attempts(sense_id, answered_at desc);

-- The headword must still be unique, but the meaning no longer has to be
-- unique per word: that is the whole point of senses.
create unique index if not exists senses_word_position_unique on senses (word_id, position);
