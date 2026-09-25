-- =========================================================
-- TOEFL vocabulary trainer - initial schema
-- Paste into the Supabase SQL Editor and run, or apply with `supabase db push`.
-- The local JSON backend stores the same shape; see src/lib/db/local.ts.
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- 1) Words (headwords)
-- ---------------------------------------------------------
create table if not exists words (
  id uuid primary key default gen_random_uuid(),
  headword text not null,
  meaning_ko text not null,
  test_point text,                        -- exam note; null when left blank
  difficulty_stars smallint not null default 3 check (difficulty_stars in (1, 2, 3)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists words_headword_unique on words (lower(headword));

-- ---------------------------------------------------------
-- 2) Synonyms (any number per word)
-- ---------------------------------------------------------
create table if not exists synonyms (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references words(id) on delete cascade,
  synonym text not null,
  position int not null default 0
);
create index if not exists synonyms_word_id_idx on synonyms(word_id);

-- ---------------------------------------------------------
-- 3) Derived words (part of speech + word)
-- ---------------------------------------------------------
create table if not exists derived_words (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references words(id) on delete cascade,
  pos text not null,                      -- n, v, adj, adv, prep, conj, pron, interj
  derived_word text not null,
  position int not null default 0
);
create index if not exists derived_words_word_id_idx on derived_words(word_id);

-- ---------------------------------------------------------
-- 4) Example sentences, with the located position of the headword
-- ---------------------------------------------------------
create table if not exists examples (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references words(id) on delete cascade,
  sentence text not null,
  matched_surface_form text not null,     -- the form as it appears, e.g. "running"
  match_start int not null,               -- character index, 0-based, inclusive
  match_end int not null,                 -- character index, exclusive; equal to
                                          -- match_start when the headword was
                                          -- not found (no blank_fill question)
  position int not null default 0
);
create index if not exists examples_word_id_idx on examples(word_id);

-- ---------------------------------------------------------
-- 5) Exam questions, generated automatically when a word is registered
-- ---------------------------------------------------------
do $$ begin
  create type question_type as enum ('meaning_write', 'synonym_choice', 'blank_fill');
exception
  when duplicate_object then null;
end $$;

create table if not exists exam_questions (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references words(id) on delete cascade,
  question_type question_type not null,
  example_id uuid references examples(id) on delete set null,  -- used by blank_fill
  created_at timestamptz not null default now()
);
create index if not exists exam_questions_word_id_idx on exam_questions(word_id);

-- ---------------------------------------------------------
-- 6) Exam sessions (one sitting)
-- ---------------------------------------------------------
create table if not exists exam_sessions (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ---------------------------------------------------------
-- 7) Attempt log, one row per answered question. The star rating is
--    recalculated from these rows after every sitting.
-- ---------------------------------------------------------
create table if not exists exam_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references exam_sessions(id) on delete set null,
  question_id uuid not null references exam_questions(id) on delete cascade,
  word_id uuid not null references words(id) on delete cascade,  -- denormalised for aggregation
  is_correct boolean not null,
  user_answer text,
  answered_at timestamptz not null default now()
);
create index if not exists exam_attempts_word_id_idx on exam_attempts(word_id, answered_at desc);

-- ---------------------------------------------------------
-- 8) Which words have already been shown in "Today's words" on a given day,
--    so pressing the button again continues rather than restarting
-- ---------------------------------------------------------
create table if not exists today_word_log (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references words(id) on delete cascade,
  shown_on date not null default current_date,
  -- Which round of the day this word belongs to. Reloading the page replays the
  -- current batch; asking for more words starts the next one.
  batch int not null default 1,
  unique (word_id, shown_on)
);

-- ---------------------------------------------------------
-- Keep updated_at current
-- ---------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists words_set_updated_at on words;
create trigger words_set_updated_at
  before update on words
  for each row execute function set_updated_at();

-- ---------------------------------------------------------
-- Note on row level security
-- RLS is left off. This is a single-person app with no login: every read and
-- write goes through a Next.js route handler using the service role key, so
-- outside that server code the only way into these tables is the Supabase
-- dashboard. The moment this needs to serve more than one PERSON (as opposed to
-- more than one device), add Supabase Auth, a user column on every table, and
-- RLS policies - before that, not after.
-- ---------------------------------------------------------
