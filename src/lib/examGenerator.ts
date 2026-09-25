import type { Word } from '@/lib/types';

/**
 * Draw `count` words for a sitting, weighted by star rating.
 *
 * Weight is the star count itself, so a 3-star (unfamiliar) word is three times
 * as likely to come up as a 1-star (memorised) one.
 *
 * Two limits keep a sitting from being dominated by one word:
 *   - a cooldown, so a word cannot reappear for a few draws; and
 *   - `maxPerWord`, a hard ceiling on total appearances.
 * If the caps make it impossible to reach `count`, the result is short rather
 * than padded - a shorter exam beats the same word five times.
 */
export function pickWeightedWords<T extends Word>(
  words: T[],
  count: number,
  maxPerWord = Infinity
): T[] {
  if (words.length === 0) return [];

  const weightOf = (w: T) => w.difficulty_stars;
  // Scale the cooldown to the vocabulary size: with only a handful of words, a
  // long cooldown would empty the pool every draw and defeat the weighting.
  const cooldown = Math.max(1, Math.min(8, Math.floor(words.length / 3)));

  const timesPicked = new Map<string, number>();
  const recentlyPicked: string[] = [];
  const picked: T[] = [];

  for (let i = 0; i < count; i++) {
    const underCap = words.filter((w) => (timesPicked.get(w.id) ?? 0) < maxPerWord);
    if (underCap.length === 0) break;

    // Prefer words that are off cooldown, but never break the cap to fill a slot.
    const offCooldown = underCap.filter((w) => !recentlyPicked.includes(w.id));
    const usablePool = offCooldown.length > 0 ? offCooldown : underCap;

    const totalWeight = usablePool.reduce((sum, w) => sum + weightOf(w), 0);
    let r = Math.random() * totalWeight;
    let chosen = usablePool[usablePool.length - 1];
    for (const w of usablePool) {
      r -= weightOf(w);
      if (r <= 0) {
        chosen = w;
        break;
      }
    }

    picked.push(chosen);
    timesPicked.set(chosen.id, (timesPicked.get(chosen.id) ?? 0) + 1);
    recentlyPicked.push(chosen.id);
    if (recentlyPicked.length > cooldown) recentlyPicked.shift();
  }

  return picked;
}

/**
 * Wrong answers for a "choose the synonym" question.
 *
 * Distractors come from other words' synonyms, preferring words whose Korean
 * meaning differs from the target - a distractor that means the same thing is
 * not wrong, just unlucky. With a small vocabulary that filter can starve, so
 * it is relaxed rather than returning too few choices.
 */
export function pickSynonymDistractors(targetWord: Word, allWords: Word[], count = 3): string[] {
  const ownSynonyms = new Set(targetWord.synonyms.map((s) => s.synonym.toLowerCase().trim()));
  const targetMeaning = targetWord.meaning_ko.trim();

  const otherSynonyms = (filterByMeaning: boolean) =>
    uniqueStrings(
      allWords
        .filter((w) => w.id !== targetWord.id)
        .filter((w) => !filterByMeaning || w.meaning_ko.trim() !== targetMeaning)
        .flatMap((w) => w.synonyms.map((s) => s.synonym))
        .filter((syn) => !ownSynonyms.has(syn.toLowerCase().trim()))
    );

  const strictPool = shuffle(otherSynonyms(true));
  const result = strictPool.slice(0, count);

  if (result.length < count) {
    for (const syn of shuffle(otherSynonyms(false))) {
      if (result.length >= count) break;
      if (!result.includes(syn)) result.push(syn);
    }
  }

  return result;
}

function uniqueStrings(arr: string[]): string[] {
  return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));
}

/** Fisher-Yates, in place. */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
