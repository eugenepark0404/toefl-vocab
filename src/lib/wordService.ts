import { findHeadwordInSentence } from '@/lib/wordMatcher';
import type { NewWordRecord, PlannedQuestion } from '@/lib/db/types';
import type { WordFormInput } from '@/lib/types';

/**
 * Turn raw form input into a storable record: trim everything, drop empty
 * rows, and locate the headword inside each example sentence.
 *
 * This runs before either storage backend is touched, so a word registered
 * locally and the same word registered against Supabase produce identical
 * rows.
 */
export function buildWordRecord(input: WordFormInput): NewWordRecord {
  const headword = input.headword.trim();

  const examples = (input.examples ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .map((sentence) => {
      const match = findHeadwordInSentence(headword, sentence);
      // A failed match is recorded as a zero-length span at 0. The sentence is
      // still worth keeping (it shows on the word card); it just can't become
      // a fill-in-the-blank question until the span is corrected.
      return {
        sentence,
        matched_surface_form: match?.matchedSurfaceForm ?? headword,
        match_start: match?.start ?? 0,
        match_end: match?.end ?? 0,
      };
    });

  return {
    headword,
    meaning_ko: input.meaning_ko.trim(),
    // An empty test point clears the field only; the word still registers.
    test_point: input.test_point?.trim() ? input.test_point.trim() : null,
    synonyms: (input.synonyms ?? []).map((s) => s.trim()).filter(Boolean),
    derived_words: (input.derived_words ?? [])
      .filter((d) => d.word?.trim())
      .map((d) => ({ pos: d.pos, derived_word: d.word.trim() })),
    examples,
  };
}

/**
 * Decide which of the three question types this word can support.
 *
 * `meaning_write` always works. The other two need material:
 *   - `synonym_choice` needs at least one synonym.
 *   - `blank_fill` needs an example whose headword span was actually found.
 *     Without a real span, blanking would return the sentence unchanged and
 *     hand the student the answer, so no question is created at all.
 */
export function planQuestions(record: NewWordRecord): PlannedQuestion[] {
  const planned: PlannedQuestion[] = [
    { question_type: 'meaning_write', example_index: null },
  ];

  if (record.synonyms.length > 0) {
    planned.push({ question_type: 'synonym_choice', example_index: null });
  }

  const blankableIndex = record.examples.findIndex((e) => e.match_end > e.match_start);
  if (blankableIndex >= 0) {
    planned.push({ question_type: 'blank_fill', example_index: blankableIndex });
  }

  return planned;
}

/** Count of examples whose headword could not be located automatically. */
export function unmatchedExampleCount(record: NewWordRecord): number {
  return record.examples.filter((e) => e.match_end <= e.match_start).length;
}
