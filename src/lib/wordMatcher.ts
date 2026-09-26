/**
 * Locating a headword inside an example sentence.
 *
 * Rather than pull in a morphological analyser, this covers the inflections a
 * TOEFL vocabulary book actually produces: plurals, third person singular,
 * -ing, -ed, and comparatives. Irregular forms (go/went, be/was) are not
 * handled and will simply fail to match.
 *
 * Multi-word headwords work too, because much of what gets studied is phrasal:
 * "account for" has to match "accounted for" and "accounts for". Only the
 * first word inflects, since that is where English carries the tense.
 *
 * A failed match is not an error. The sentence is still stored and shown on the
 * word card; it just does not become a fill-in-the-blank question, because
 * blanking a span that was never found would show the student the answer.
 */

export interface MatchResult {
  matchedSurfaceForm: string;
  start: number;
  end: number;
}

function generateInflectedForms(base: string): string[] {
  const lower = base.toLowerCase();
  const forms = new Set<string>([lower]);

  // Plural / third person singular
  if (/[sxz]$/.test(lower) || /(ch|sh)$/.test(lower)) {
    forms.add(lower + 'es');
  } else if (/[^aeiou]y$/.test(lower)) {
    forms.add(lower.slice(0, -1) + 'ies');
  } else {
    forms.add(lower + 's');
  }

  // -ing
  if (/e$/.test(lower) && !/ee$/.test(lower)) {
    forms.add(lower.slice(0, -1) + 'ing');
  } else {
    forms.add(lower + 'ing');
  }

  // -ed (past and past participle, regular verbs only)
  if (/e$/.test(lower)) {
    forms.add(lower + 'd');
  } else if (/[^aeiou]y$/.test(lower)) {
    forms.add(lower.slice(0, -1) + 'ied');
  } else {
    forms.add(lower + 'ed');
  }

  // Comparative / superlative, in case the word is an adjective or adverb
  forms.add(lower + 'er');
  forms.add(lower + 'est');

  return Array.from(forms);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findHeadwordInSentence(headword: string, sentence: string): MatchResult | null {
  const words = headword.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  const [first, ...rest] = words;
  // Only the first word inflects: "accounted for", never "account fored".
  // Longest form first, so "accounted" wins over a shorter form that also
  // happens to appear.
  const firstForms = generateInflectedForms(first).sort((a, b) => b.length - a.length);
  // \s+ between the words rather than a literal space, so a line break or a
  // double space in the pasted sentence still matches.
  const tail = rest.map((w) => escapeRegExp(w)).join('\\s+');

  for (const form of firstForms) {
    const body = rest.length > 0 ? `${escapeRegExp(form)}\\s+${tail}` : escapeRegExp(form);
    const pattern = new RegExp(`\\b${body}\\b`, 'i');
    const match = pattern.exec(sentence);
    if (match && match.index !== undefined) {
      const start = match.index;
      const end = start + match[0].length;
      // Slice from the sentence, not the pattern, to keep the original casing
      // and the exact spacing between the words.
      return { matchedSurfaceForm: sentence.slice(start, end), start, end };
    }
  }
  return null;
}

export interface BlankHint {
  /** What goes into the sentence, e.g. "c__________" for "conspicuous". */
  placeholder: string;
  /** The revealed opening letters. */
  prefix: string;
  /** Total length of the answer, so the blank can be counted. */
  length: number;
}

/**
 * Build the blank for a fill-in-the-blank question.
 *
 * A bare "_____" is close to unanswerable: nothing says how long the word is or
 * where it starts, and the student is guessing from the sentence alone. So the
 * opening letter is revealed - two of them once the word reaches eight
 * characters - and every remaining letter becomes one underscore, which makes
 * the length countable.
 *
 * Non-letters are left visible, so a hyphenated form reads "w___-_____" rather
 * than hiding its own shape.
 */
export function buildBlankHint(surfaceForm: string): BlankHint {
  const chars = Array.from(surfaceForm);
  // Never reveal the whole word, however short it is.
  const revealCount = Math.min(chars.length >= 8 ? 2 : 1, Math.max(chars.length - 1, 0));

  const placeholder = chars
    .map((ch, i) => (i < revealCount ? ch : /[A-Za-z0-9]/.test(ch) ? '_' : ch))
    .join('');

  return { placeholder, prefix: chars.slice(0, revealCount).join(''), length: chars.length };
}

/** Replace the matched span with a blank, for fill-in-the-blank questions. */
export function buildBlankedSentence(
  sentence: string,
  start: number,
  end: number,
  placeholder = '_____'
): string {
  // Callers should never pass an empty span, but returning the sentence intact
  // would hand over the answer, so refuse instead.
  if (end <= start) return sentence;
  return `${sentence.slice(0, start)}${placeholder}${sentence.slice(end)}`;
}
