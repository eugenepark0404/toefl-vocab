# TOEFL Vocabulary Trainer

A personal TOEFL vocabulary app. Add words on a laptop, review and test yourself
on a phone. The interface is in Korean, because the whole point is drilling
English headwords against Korean meanings.

It does three things:

- **Register words** — a headword with one or more meanings. Each meaning
  carries its own synonyms, examples and exam note, because "account for" means
  설명하다, 차지하다 and 원인이 되다, and those are three different things to learn.
  Exam questions are generated automatically as you save.
- **Today's words** — up to 30 flip cards a day, drawn from the words you
  currently know least well. Refreshing replays the same set; moving on to the
  next 30 is an explicit button.
- **Exam** — up to 45 questions a day, weighted so unfamiliar words come up more
  often. Your answers feed back into a per-word difficulty rating.

## Quick start

On Windows, double-click `start-app.bat`. It installs and builds on first run,
then starts the app and opens it in the browser. Closing the window stops it.

Otherwise:

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

**1. Create a Supabase project** at <https://supabase.com>. Pick a region near
you and set a database password — you will need that password in step 3, and it
is not one of the API keys.

**2. Collect three values.** The dashboard layout changes from time to time, so
these are described by what they are rather than where the button is. If the
navigation is hard to follow, the project settings pages are reachable directly
at `https://supabase.com/dashboard/project/<your-project-ref>/settings/api` and
`.../settings/database`, and most dashboards have a search or command palette
(Ctrl/Cmd-K) that will jump to "API" or "Database".

| Value | Where | Goes into |
| --- | --- | --- |
| Project URL | Settings → API | `NEXT_PUBLIC_SUPABASE_URL` |
| `service_role` key | Settings → API (needs revealing) | `SUPABASE_SERVICE_ROLE_KEY` |
| Connection string (URI) | Settings → Database | `DATABASE_URL` |

Put all three in `.env.local` (copy `.env.example`). In the connection string,
replace `[YOUR-PASSWORD]` with the database password from step 1.

**3. Create the tables:**

```bash
npm run migrate
```

This applies everything in `supabase/migrations/` over the connection string,
so there is no need to find the SQL editor in the dashboard. The migrations use
`if not exists` throughout and are safe to re-run; run this again whenever the
schema changes. If you prefer the dashboard, pasting each file into the SQL
editor and running it does exactly the same thing.

**4. Restart the dev server** and open the app. The "local storage mode" notice
on the home page disappears once Supabase is in use — that notice is the quickest
way to tell which backend you are on.

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

### Editing

A word can be edited from its card in the list. Meanings sent back with their
id are updated in place, so **the star rating and the answering history
survive**: fixing a typo in an example must not quietly reset what the app
knows about how well a meaning is known. Meanings without an id are added at
three stars, and meanings left out are removed along with their history.

Exam questions are reconciled rather than rebuilt for the same reason.
`exam_attempts` references `exam_questions` with `on delete cascade`, so
dropping and recreating a question would take its history with it. A question
is only deleted when the meaning can no longer support that type at all — when
its last synonym is removed, say.

Headwords are unique, case-insensitively and ignoring extra whitespace. A
clash is refused rather than merged, and the registration form says so while
the headword is being typed rather than after the whole form has been filled
in. Renaming a word onto itself is naturally allowed.

### Senses

A sense — one meaning of one headword — is the unit this app studies, rates and
examines. Rating the headword as a whole would let a meaning you know hide one
you do not: score well on "account for = 설명하다" and the word looks learned,
while "= 차지하다" is still a blank.

So each sense gets its own star rating and competes for exam slots on its own.
A word's badge in the list shows its **least**-known sense, since a word is only
learned once every meaning of it is. Derived forms stay attached to the
headword, not to a sense.

A word with several meanings also changes what a question has to say. "What
does account for mean?" has three right answers, so:

- **Write the meaning** shows an example of that sense as context, the way the
  word is met in reading. With no example available it names the sense by
  number instead.
- **Choose the synonym** names the Korean meaning in the prompt. Single-sense
  words never see this, so nothing gets easier than it was.
- Distractors never include a synonym of the same word's *other* senses.
  Offering "supporter" as a wrong answer for advocate-the-verb would be
  indefensible — it really is a synonym of advocate.
- Revealing an answer also lists the word's other meanings, which is the
  natural moment to be reminded of them.

### Difficulty rating (stars)

Stars run backwards from the usual convention — **more stars means you know the
sense less well**, and the goal is to drive everything down to one star.

| Stars | Meaning |
| --- | --- |
| ★★★ | Unfamiliar |
| ★★☆ | Recognised, but not reliably |
| ★☆☆ | Memorised |

You never set this by hand. After every exam it is recalculated from that
sense's own history (`src/lib/difficulty.ts`):

1. No exam history → **3** (new word)
2. Last 5 attempts, all correct → **1**
3. At least 3 correct out of the last 5 → **2**
4. Otherwise → **3**

A sense with fewer than five attempts cannot reach one star. There is not yet
enough evidence that it is memorised, so the rating stays conservative.

### Exam generation

Senses are drawn with their star count as the weight, so a 3-star sense is
three times as likely to appear as a 1-star one. Two limits keep one entry from
dominating a sitting: a cooldown that blocks immediate repeats, and a cap of
three appearances per **headword** — counting by headword rather than by sense
is what stops a word with many meanings from crowding out everything else. With
a small vocabulary the exam is simply shorter than 45 questions rather than
looping over the same handful.

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
diminished over time"* both work. Multi-word headwords work too, with the
inflection on the first word: `account for` matches *"accounts for"* and
*"accounted for"*.

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
    words/[id]/edit/page.tsx      Edit an existing word
    today/page.tsx                Today's words (flip cards)
    exam/page.tsx                 Exam runner
    api/
      words/route.ts              List / create words
      words/[id]/route.ts         Fetch / update / delete one word
      today/route.ts              Today's 2-3 star words
      exam/generate/route.ts      Build a sitting
      exam/submit/route.ts        Record answers, recalculate stars
      seed/route.ts               Load the starter vocabulary
  components/
    WordForm.tsx                  Registration form
    WordList.tsx                  Search, filter, delete
    WordCard.tsx                  Collapsed / expanded word card
    SenseDetail.tsx               One meaning, shared by the list and the card
    FlashCard.tsx                 Flip card
    ExamQuestion.tsx              Per-type question rendering
    SeedButton.tsx                Starter vocabulary loader
  lib/
    db/                           Storage interface and the two backends
    types.ts                      Shared types, incl. Sense
    wordService.ts                Input to storable record; question planning
    wordMatcher.ts                Headword location in example sentences
    difficulty.ts                 Star calculation
    examGenerator.ts              Weighted drawing and distractor selection
    seedWords.ts                  20 starter words
start-app.bat                     Double-click launcher (Windows)
scripts/start-app.ps1             What the launcher actually runs
scripts/migrate.mjs               Applies the SQL migrations (npm run migrate)
supabase/migrations/              Postgres schema, applied in filename order
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
