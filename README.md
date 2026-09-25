# TOEFL Vocabulary Trainer

A personal TOEFL vocabulary app. Add words on a laptop, review and test yourself
on a phone. The interface is in Korean, because the whole point is drilling
English headwords against Korean meanings.

It does three things:

- **Register words** — headword, synonyms, derived words, example sentences and
  an optional exam note. Exam questions are generated automatically as you save.
- **Today's words** — up to 30 flip cards a day, drawn from the words you
  currently know least well. Refreshing replays the same set; moving on to the
  next 30 is an explicit button.
- **Exam** — up to 45 questions a day, weighted so unfamiliar words come up more
  often. Your answers feed back into a per-word difficulty rating.

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. That is the whole setup — no account, no database to
provision. On first run the word list offers to load 20 TOEFL words with
examples and synonyms already filled in, so you can try the review and exam
flows before typing anything of your own.

Words are saved to `.data/toefl-vocab.json` in the project directory. It is real
persistence — restart and your words are still there — but it lives on one
machine. For the same words on your phone, see below.

## Sync across devices

Cross-device sync needs a shared database. The app switches to Supabase
automatically as soon as it is configured; nothing else changes.

1. Create a project at <https://supabase.com>.
2. Open **SQL Editor** and run `supabase/migrations/0001_init.sql`. Every table,
   index and trigger is in that one file.
3. Copy `.env.example` to `.env.local` and fill in the two values from
   **Project Settings → API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
4. Restart the dev server. The "local storage mode" notice on the home page
   disappears once Supabase is in use.

> The `service_role` key bypasses row level security, so it must never reach a
> browser. It has no `NEXT_PUBLIC_` prefix for exactly that reason, and every
> database call goes through a Next.js route handler on the server. Use the
> `service_role` key here, not the `anon` key.

### Deploying

Import the repository into Vercel, add the same two environment variables in
**Settings → Environment Variables**, and deploy. Open the deployed URL on both
devices and they read and write the same rows.

Configure Supabase before deploying. The local file backend cannot work on
Vercel — serverless filesystems are read-only and thrown away between requests —
so a deployment without those variables will fail to save anything.

## How it works

### Storage

`src/lib/db/` holds one interface (`WordRepository`) and two implementations:

| Backend | When it is used | Good for |
| --- | --- | --- |
| `local.ts` | No Supabase env vars | Trying it out, offline use on one machine |
| `supabase.ts` | Both env vars set | Real use, phone sync, deployment |

Route handlers only ever call `getDb()`, so nothing above that line knows or
cares which backend is active.

### Today's words

Reading the list is idempotent. Once a batch has been chosen for the day it is
replayed on every later call, so a refresh — or React running the effect twice
in development — shows the same cards rather than consuming them. Asking for
more is a separate action, and replay returns only the current batch, so a
refresh during round two does not silently reopen round one.

### Difficulty rating (stars)

Stars run backwards from the usual convention — **more stars means you know the
word less well**, and the goal is to drive everything down to one star.

| Stars | Meaning |
| --- | --- |
| ★★★ | Unfamiliar |
| ★★☆ | Recognised, but not reliably |
| ★☆☆ | Memorised |

You never set this by hand. After every exam it is recalculated from that word's
history (`src/lib/difficulty.ts`):

1. No exam history → **3** (new word)
2. Last 5 attempts, all correct → **1**
3. At least 3 correct out of the last 5 → **2**
4. Otherwise → **3**

A word with fewer than five attempts cannot reach one star. There is not yet
enough evidence that it is memorised, so the rating stays conservative.

### Exam generation

Words are drawn with their star count as the weight, so a 3-star word is three
times as likely to appear as a 1-star one. Two limits keep one word from
dominating a sitting: a cooldown that blocks immediate repeats, and a hard cap
of three appearances per word. With fewer than 15 words the exam is simply
shorter than 45 questions rather than looping over the same handful.

Three question types are mixed:

- **Write the meaning** — free text. Korean glosses have too many valid
  phrasings to grade by string comparison, so you reveal the answer and mark
  yourself.
- **Choose the synonym** — multiple choice, graded automatically. Wrong options
  are drawn from other words' synonyms, preferring words whose meaning differs
  from the answer.
- **Fill in the blank** — the example sentence with the headword removed. The
  opening letter is given (two once the word reaches eight characters) and each
  remaining letter becomes one underscore, so the length is countable:
  `The red building was co_________ among the gray offices.` A bare `_____` is
  close to unanswerable. An exact match is graded automatically; anything else
  reveals the answer and falls back to self-marking, so a defensible near-miss
  is not forced to wrong.

Each word starts at a random question type and rotates through the others on
repeat appearances, so seeing a word twice means being asked two different ways.

### Finding the headword in an example

When you save an example sentence, the app locates the headword in it and stores
the character span, which is what makes fill-in-the-blank questions possible.
Regular inflections are handled — plurals, third person singular, `-ing`, `-ed`,
comparatives — so *"Smartphones have become ubiquitous"* and *"Interest
diminished over time"* both work.

Irregular forms are not (`undergo` → `underwent`). When the match fails the
sentence is still saved and still shows on the word card; it just never becomes
a blank-fill question, because blanking a span that was never found would print
the answer in the question. The registration form tells you when this happens,
and the word card marks the sentence.

## Project layout

```text
src/
  app/
    page.tsx                      Home, with counts and the storage-mode notice
    words/page.tsx                Word list with search and star filter
    words/new/page.tsx            Registration form
    today/page.tsx                Today's words (flip cards)
    exam/page.tsx                 Exam runner
    api/
      words/route.ts              List / create words
      words/[id]/route.ts         Fetch / delete one word
      today/route.ts              Today's 2-3 star words
      exam/generate/route.ts      Build a sitting
      exam/submit/route.ts        Record answers, recalculate stars
      seed/route.ts               Load the starter vocabulary
  components/
    WordForm.tsx                  Registration form
    WordList.tsx                  Search, filter, delete
    WordCard.tsx                  Collapsed / expanded word card
    FlashCard.tsx                 Flip card
    ExamQuestion.tsx              Per-type question rendering
    SeedButton.tsx                Starter vocabulary loader
  lib/
    db/                           Storage interface and the two backends
    types.ts                      Shared types
    wordService.ts                Input to storable record; question planning
    wordMatcher.ts                Headword location in example sentences
    difficulty.ts                 Star calculation
    examGenerator.ts              Weighted drawing and distractor selection
    seedWords.ts                  20 starter words
supabase/migrations/0001_init.sql Full Postgres schema
PRD.md                            What was specified and what was decided
IMPLEMENTATION_PLAN.md            What is done and what is left
```

## Design decisions worth knowing

- **No authentication.** This is a single-person app. Every request goes through
  a server route using the service role key. Supporting more than one person
  means adding Supabase Auth and row level security policies, and scoping every
  table by user.
- **Self-marked written answers.** Automatic grading of Korean meanings would
  reject correct answers constantly, so you grade yourself.
- **Empty exam notes are allowed.** Leaving the field blank stores `null` for it
  and nothing else; the word registers normally.
- **The local backend is a convenience, not a product.** One machine, one file.
  Anything beyond trying it out wants Supabase.

## Not implemented

See `IMPLEMENTATION_PLAN.md`. The main gaps:

- Editing a word (`PATCH`). Creating is easy; editing means rebuilding the
  auto-generated questions when synonyms or examples change.
- Manually correcting a failed headword match, by selecting the word in the
  sentence yourself.
- Per-question-type statistics.

## Tech stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres) ·
deployed on Vercel.
