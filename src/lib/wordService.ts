import { findHeadwordInSentence } from '@/lib/wordMatcher';
import type { NewSenseRecord, NewWordRecord, PlannedQuestion } from '@/lib/db/types';
import type { SenseFormInput, WordFormInput } from '@/lib/types';

/**
 * Turn raw form input into a storable record: trim everything, drop empty
 * rows, locate the headword inside each example, and work out which exam
 * questions each sense can support.
 *
 * This runs before either storage backend is touched, so a word registered
 * locally and the same word registered against Supabase produce identical
 * rows.
 */
export function buildWordRecord(input: WordFormInput): NewWordRecord {
  const headword = normaliseHeadword(input.headword);

  // A sense with no meaning is an empty row the user never filled in.
  const senses = (input.senses ?? [])
    .filter((s) => s.meaning_ko?.trim())
    .map((sense) => buildSenseRecord(headword, sense));

  return {
    headword,
    derived_words: (input.derived_words ?? [])
      .filter((d) => d.word?.trim())
      .map((d) => ({ pos: d.pos, derived_word: d.word.trim() })),
    senses,
  };
}

/**
 * Collapse the whitespace in a headword.
 *
 * Trimming the ends is not enough once headwords can be phrases. "account for"
 * typed or pasted with two spaces is the same entry as with one, but as raw
 * text the two differ, so the duplicate check waved it through and the word
 * was silently stored twice. Normalising here means everything downstream -
 * the uniqueness check, the unique index in Postgres, the matcher - compares
 * the same thing.
 */
export function normaliseHeadword(headword: string): string {
  return headword.trim().replace(/\s+/g, ' ');
}

function buildSenseRecord(headword: string, sense: SenseFormInput): NewSenseRecord {
  const examples = (sense.examples ?? [])
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

  const record: NewSenseRecord = {
    // Carried through so an edit updates the existing row instead of
    // replacing it, which would reset the rating.
    id: sense.id,
    meaning_ko: sense.meaning_ko.trim(),
    // An empty exam note clears the field only; the sense still registers.
    test_point: sense.test_point?.trim() ? sense.test_point.trim() : null,
    synonyms: (sense.synonyms ?? []).map((s) => s.trim()).filter(Boolean),
    examples,
    questions: [],
  };
  record.questions = planQuestions(record);
  return record;
}

/**
 * Decide which of the three question types this sense can support.
 *
 * `meaning_write` always works. The other two need material:
 *   - `synonym_choice` needs at least one synonym.
 *   - `blank_fill` needs an example whose headword span was actually found.
 *     Without a real span, blanking would return the sentence unchanged and
 *     hand the student the answer, so no question is created at all.
 */
export function planQuestions(sense: NewSenseRecord): PlannedQuestion[] {
  const planned: PlannedQuestion[] = [{ question_type: 'meaning_write', example_index: null }];

  if (sense.synonyms.length > 0) {
    planned.push({ question_type: 'synonym_choice', example_index: null });
  }

  const blankableIndex = sense.examples.findIndex((e) => e.match_end > e.match_start);
  if (blankableIndex >= 0) {
    planned.push({ question_type: 'blank_fill', example_index: blankableIndex });
  }

  return planned;
}

/** Examples, across all senses, whose headword could not be located. */
export function unmatchedExampleCount(record: NewWordRecord): number {
  return record.senses.reduce(
    (total, sense) => total + sense.examples.filter((e) => e.match_end <= e.match_start).length,
    0
  );
}
