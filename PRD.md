# Product requirements

What was asked for, and the decisions taken where the request left room. Where
this document and the code disagree, the comments in the code are the more
specific and more recent decision.

## 0. Settled assumptions

| Question | Decision |
| --- | --- |
| Who uses it | One person. No login; every device shares one database. |
| Which words the 45-question exam draws from | All registered words, weighted by star count, so unfamiliar words come up more often. |
| Where wrong synonym options come from | Synonyms of other words, preferring words whose Korean meaning differs from the answer. |
| Starting star rating for a new word | 3. There is no exam history yet, so treat it as unfamiliar. |
| Empty exam note | Store `null` for that field only. The word still registers normally. |
| Finding the headword in an example | Case-insensitive, and regular inflections (plural, third person singular, `-ing`, `-ed`, comparative) are recognised automatically. |

## 1. Registering a word

One screen, saved as a single card:

- **Headword** (English, required)
- **Synonyms** (any number, added and removed with a button)
- **Meaning** (Korean, required)
- **Derived words**: part of speech from a dropdown (n / v / adj / adv / prep /
  conj / pron / interj) plus the word
- **Example sentences**: any number. The app locates the headword — or an
  inflected form of it — in each sentence and stores its position, which is what
  later makes a fill-in-the-blank question possible.
- **Exam note**: only filled in when the vocabulary book gives one. Left blank,
  that field alone is left empty; the word itself registers normally.

Saving also generates up to three exam questions, skipping any type it has no
material for:

1. Headword → write the Korean meaning (`meaning_write`) — always generated
2. Headword → choose the synonym (`synonym_choice`) — needs at least one synonym
3. Fill in the blank (`blank_fill`) — needs an example sentence in which the
   headword was actually located

## 2. The word list

- A card shows **headword, meaning and star rating** only.
- Tapping it expands the card to show synonyms, derived words, examples and the
  exam note.
- **The star rating is never set by hand.** The system recalculates it from exam
  results:
  - ★☆☆ memorised
  - ★★☆ recognised, but not reliably
  - ★★★ unfamiliar

## 3. Today's words

- Draws from words that are at 2 or 3 stars at the moment the button is pressed.
- **Flip cards**: the headword on the front; tap to turn it over for the
  meaning, synonyms, derived words, examples and exam note.
- **30 a day.** After the last card, the whole set is listed again for review.
- The day's batch is stable: reloading replays it rather than consuming it.
  Continuing to the next 30 is an explicit button, and only the current batch is
  replayed.

## 4. The exam

- **45 questions a day**, shuffled from the questions generated at registration.
- All three question types are mixed.
- **A word must not come up too often or twice in a row.** A cooldown blocks
  immediate repeats, and no word may appear more than three times in a sitting.
  Below 15 registered words the exam is shorter than 45 questions rather than
  looping over the same handful.
- **Fill-in-the-blank gives a hint.** The opening letter (two from eight
  characters up) and one underscore per remaining letter. Without it the blank
  is a guess from context alone. An exact match grades itself; anything else
  falls back to self-marking.
- **Written answers are self-marked.** A Korean meaning has too many valid
  phrasings to grade by string comparison, so the student types an answer,
  presses confirm, sees the correct answer, and states whether they got it
  right.

### The star algorithm

Each word carries up to three questions. After every sitting, that word's rating
is recalculated (`src/lib/difficulty.ts`):

1. No exam history → **3**
2. The last 5 attempts, all correct → **1**
3. At least 3 correct out of the last 5 → **2**
4. Otherwise (0–2 correct) → **3**

Fewer stars means the word is better known. A word with fewer than five attempts
cannot reach one star: while the evidence is thin the rating stays conservative
and bottoms out at two.

## 5. Data model

`words` 1—N `synonyms` / `derived_words` / `examples` / `exam_questions`
`exam_questions` 1—N `exam_attempts` (the evidence the star rating is built from)
`exam_sessions` 1—N `exam_attempts` (one sitting)
`today_word_log` — which words have already been shown today

Full column definitions are in `supabase/migrations/0001_init.sql`. The local
file backend stores the same shape as JSON.

## 6. Added during implementation

Not in the original request, added because the app was otherwise unusable on a
fresh clone or misleading in practice:

- **A local storage backend.** Without it, nothing runs until a Supabase project
  exists. The app now stores to a JSON file by default and switches to Supabase
  as soon as it is configured.
- **Starter vocabulary.** 20 TOEFL words, loaded on request from the empty word
  list, so the review and exam flows can be tried immediately.
- **Search and a star filter** on the word list, and a delete button.
- **No blank-fill question when the headword was not found.** Blanking a span
  that was never located returns the sentence unchanged, which would print the
  answer inside the question. Those sentences are kept and displayed, but never
  turned into questions, and the failure is reported at registration.
