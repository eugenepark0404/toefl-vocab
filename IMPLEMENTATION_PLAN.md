# Implementation status

What works, and what is left. The core loop — register a word, review it, be
tested on it, watch its rating move — is complete and has been exercised end to
end.

## Done

- [x] Storage layer with two interchangeable backends (`src/lib/db/`): a JSON
      file by default, Supabase when configured. Route handlers only call
      `getDb()`.
- [x] Registration, with automatic question generation and headword location in
      example sentences.
- [x] Word list: search across headword, meaning and synonyms; star filter;
      delete with confirmation.
- [x] Today's words: flip cards, 30 a day, already-seen words skipped for the
      rest of the day.
- [x] Exam: star-weighted drawing, cooldown, a cap of three appearances per
      word, all three question types, self-marking, automatic submission.
- [x] Star recalculation after every sitting.
- [x] Starter vocabulary of 20 words, loaded on request.
- [x] Duplicate headwords rejected with a readable message (409) instead of a
      raw database error.
- [x] Mobile viewport and layout.
- [x] `npm run migrate`, so setting up the database does not depend on finding
      the SQL editor in a dashboard that keeps changing.
- [x] Schema verified against a real Postgres engine: migrations apply, are
      idempotent, and the constraints the app relies on (case-insensitive
      unique headword, one log row per word per day, the question-type enum,
      the star range, the updated_at trigger, cascade delete) all hold.

## Phase 1 — before deploying

- [ ] Create a Supabase project, put the three values from the README in
      `.env.local`, and run `npm run migrate`.
- [ ] Run the app locally against Supabase first and confirm the "local storage
      mode" notice is gone. The Supabase client code has not been exercised
      against a live instance yet; the schema has (see below).
- [ ] Set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel.
      The local file backend cannot work on a serverless deployment.
- [ ] After deploying, register a word on the laptop and confirm it appears on
      the phone.
- [ ] Decide what to do about the lack of authentication. On a public URL,
      anyone with the link can read, add and delete words.

## Phase 2 — registration

- [ ] Manual correction when the headword cannot be located in an example.
      The failure is already detected, reported at registration and marked on
      the word card; what is missing is a way to select the word in the sentence
      yourself and store that span. Storage side, this needs an example-level
      update plus creation of the `blank_fill` question that was skipped.
- [ ] Irregular inflections in `src/lib/wordMatcher.ts`. Worth doing only if
      your own sentences actually trip on it — the manual fallback above covers
      the same ground more generally.

## Phase 3 — editing

- [ ] `PATCH /api/words/[id]`. The complication is not the word row but its
      children: changing the synonyms or examples means regenerating the
      affected questions, and deleting an example has to delete any `blank_fill`
      question pointing at it.

## Phase 4 — scale

- [ ] Pagination or infinite scroll on the word list. Client-side search is fine
      for a few hundred words and will not be past a few thousand.
- [ ] Bulk import from a spreadsheet or CSV, if you are typing in a whole
      vocabulary book.

## Phase 5 — study quality

- [ ] Accuracy by question type, to show whether the weakness is recall,
      synonyms or usage.
- [ ] Handle abandoning an exam midway. The session row currently stays open
      with no `completed_at`, which is harmless but leaves noise in the table.
- [ ] Reconsider the star algorithm once there is real history. The five-attempt
      window is a guess, not a measurement.

## Phase 6 — optional

- [ ] PWA manifest, so the app can be added to a phone home screen.
- [ ] Flip animation on the review cards.

## Deliberately not included

- Authentication. Single-person app, confirmed. Supporting more people means
  Supabase Auth, row level security, and a user column on every table.
- Localisation. The interface is Korean by design.
- Offline support.
