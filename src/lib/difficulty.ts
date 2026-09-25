/**
 * Personal difficulty rating (stars).
 *
 * Stars run backwards from the usual convention: more stars means the word is
 * LESS familiar, so the goal is to drive every word down to one star.
 *   3 stars - unfamiliar
 *   2 stars - recognised, but not reliably
 *   1 star  - memorised
 *
 * The rating is never set by hand. It is recomputed from exam history right
 * after every sitting, in this order:
 *   1. No exam history at all                      -> 3 (new word)
 *   2. Exactly the last 5 attempts, all correct    -> 1
 *   3. At least 3 correct in the last 5 attempts   -> 2
 *   4. Anything else (0-2 correct)                 -> 3
 *
 * A word with fewer than five attempts cannot reach one star: there is not yet
 * enough evidence that it is memorised, so the rating stays conservative and
 * bottoms out at two.
 *
 * @param attemptsInOrder Every attempt at this word as correct/incorrect,
 *   ordered oldest to newest. The caller is responsible for that ordering.
 */
export function calculateDifficultyStars(attemptsInOrder: boolean[]): 1 | 2 | 3 {
  if (attemptsInOrder.length === 0) return 3;

  const window = attemptsInOrder.slice(-5);
  const correctCount = window.filter(Boolean).length;

  if (window.length === 5 && correctCount === 5) return 1;
  if (correctCount >= 3) return 2;
  return 3;
}
