import type { SenseForExam } from '@/lib/db/types';

/**
 * Draw `count` senses for a sitting, weighted by star rating.
 *
 * Senses, not words, are the unit: a word with three meanings has three things
 * to learn, and each is rated separately, so each competes for slots on its
 * own merit. Weight is the star count itself, so a 3-star (unfamiliar) sense
 * is three times as likely to come up as a 1-star (memorised) one.
 *
 * Two limits keep a sitting from being dominated by one entry:
 *   - a cooldown, so the same sense cannot reappear for a few draws; and
 *   - `maxPerWord`, a ceiling on appearances of any one HEADWORD. Capping by
 *     word rather than by sense is what stops a three-sense word from taking
 *     three times the share of the exam.
 * If the caps make it impossible to reach `count`, the result is short rather
 * than padded - a shorter exam beats the same word on loop.
 */
export function pickWeightedSenses(
  senses: SenseForExam[],
  count: number,
  maxPerWord = Infinity
): SenseForExam[] {
  if (senses.length === 0) return [];

  const weightOf = (s: SenseForExam) => s.difficulty_stars;
  // Scale the cooldown to the pool size: with only a handful of senses, a long
  // cooldown would empty the pool every draw and defeat the weighting.
  const cooldown = Math.max(1, Math.min(8, Math.floor(senses.length / 3)));

  const timesPickedByWord = new Map<string, number>();
  const recentlyPicked: string[] = [];
  const picked: SenseForExam[] = [];

  for (let i = 0; i < count; i++) {
    const underCap = senses.filter((s) => (timesPickedByWord.get(s.wordId) ?? 0) < maxPerWord);
    if (underCap.length === 0) break;

    // Prefer senses off cooldown, but never break the cap to fill a slot.
    const offCooldown = underCap.filter((s) => !recentlyPicked.includes(s.senseId));
    const usablePool = offCooldown.length > 0 ? offCooldown : underCap;

    const totalWeight = usablePool.reduce((sum, s) => sum + weightOf(s), 0);
    let r = Math.random() * totalWeight;
    let chosen = usablePool[usablePool.length - 1];
    for (const s of usablePool) {
      r -= weightOf(s);
      if (r <= 0) {
        chosen = s;
        break;
      }
    }

    picked.push(chosen);
    timesPickedByWord.set(chosen.wordId, (timesPickedByWord.get(chosen.wordId) ?? 0) + 1);
    recentlyPicked.push(chosen.senseId);
    if (recentlyPicked.length > cooldown) recentlyPicked.shift();
  }

  return picked;
}

/**
 * Wrong answers for a "choose the synonym" question.
 *
 * Distractors come from other words' synonyms, preferring words whose Korean
 * meaning differs from the target - a distractor that means the same thing is
 * not wrong, just unlucky.
 *
 * Synonyms of the target word's OTHER senses are excluded outright. Offering
 * "supporter" as a wrong answer for advocate-the-verb would be indefensible:
 * it really is a synonym of advocate, just of a different meaning. With a
 * small vocabulary the meaning filter can starve, so it is relaxed before the
 * choice list is allowed to come up short - but the sibling-sense rule never is.
 */
export function pickSynonymDistractors(
  target: SenseForExam,
  allSenses: SenseForExam[],
  count = 3
): string[] {
  const forbidden = new Set(
    [...target.synonyms, ...target.siblingSynonyms].map((s) => s.toLowerCase().trim())
  );
  const targetMeaning = target.meaning_ko.trim();

  const candidates = (filterByMeaning: boolean) =>
    uniqueStrings(
      allSenses
        .filter((s) => s.wordId !== target.wordId)
        .filter((s) => !filterByMeaning || s.meaning_ko.trim() !== targetMeaning)
        .flatMap((s) => s.synonyms)
        .filter((syn) => !forbidden.has(syn.toLowerCase().trim()))
    );

  const result = shuffle(candidates(true)).slice(0, count);

  if (result.length < count) {
    for (const syn of shuffle(candidates(false))) {
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
