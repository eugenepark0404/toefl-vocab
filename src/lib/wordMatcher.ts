/**
 * Locating a headword inside an example sentence.
 *
 * Rather than pull in a morphological analyser, this covers the inflections a
 * TOEFL vocabulary book actually produces: plurals, third person singular,
 * -ing, -ed, and comparatives. Irregular forms (go/went, be/was) are not
 * handled and will simply fail to match.
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
  // Longest form first, so "studies" is preferred over a shorter form that
  // happens to also appear.
  const candidates = generateInflectedForms(headword).sort((a, b) => b.length - a.length);

  for (const form of candidates) {
    const pattern = new RegExp(`\\b${escapeRegExp(form)}\\b`, 'i');
    const match = pattern.exec(sentence);
    if (match && match.index !== undefined) {
      const start = match.index;
      const end = start + match[0].length;
      // Slice from the sentence, not the pattern, to keep the original casing.
      return { matchedSurfaceForm: sentence.slice(start, end), start, end };
    }
  }
  return null;
}

/** Replace the matched span with a blank, for fill-in-the-blank questions. */
export function buildBlankedSentence(sentence: string, start: number, end: number): string {
  // Callers should never pass an empty span, but returning the sentence intact
  // would hand over the answer, so refuse instead.
  if (end <= start) return sentence;
  return `${sentence.slice(0, start)}_____${sentence.slice(end)}`;
}
