import type { Sense } from '@/lib/types';

export function starsLabel(n: 1 | 2 | 3) {
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}

/**
 * One meaning, with everything that belongs to it.
 *
 * Shared by the word list and the review card so a sense reads the same way
 * everywhere, and numbered because a word with three meanings is otherwise a
 * wall of text.
 */
export default function SenseDetail({
  sense,
  index,
  total,
  showStars = true,
}: {
  sense: Sense;
  index: number;
  total: number;
  showStars?: boolean;
}) {
  return (
    <div
      style={{
        // Only separate the senses when there is more than one to separate.
        borderTop: index > 0 ? '1px dashed #e5e7eb' : undefined,
        paddingTop: index > 0 ? 12 : 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <div>
          {total > 1 && (
            <span style={{ color: '#9ca3af', fontSize: '0.85rem', marginRight: 6 }}>{index + 1}.</span>
          )}
          <strong>{sense.meaning_ko}</strong>
        </div>
        {showStars && (
          <span className="stars" style={{ whiteSpace: 'nowrap', fontSize: '0.9rem' }}>
            {starsLabel(sense.difficulty_stars)}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
        {sense.synonyms.length > 0 && (
          <div>
            <div className="label">동의어</div>
            <div>{sense.synonyms.map((s) => s.synonym).join(', ')}</div>
          </div>
        )}

        {sense.examples.length > 0 && (
          <div>
            <div className="label">예문</div>
            <ul style={{ paddingLeft: 18 }}>
              {sense.examples.map((ex) => (
                <li key={ex.id}>
                  {ex.sentence}
                  {/* A zero-length span means the headword was not found, so
                      this sentence cannot become a fill-in-the-blank question. */}
                  {ex.match_end <= ex.match_start && (
                    <span style={{ color: '#b45309', fontSize: '0.8rem', marginLeft: 6 }}>
                      (표제어 자동 인식 실패 · 빈칸 문제 제외)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {sense.test_point && (
          <div>
            <div className="label">출제포인트</div>
            <div>{sense.test_point}</div>
          </div>
        )}
      </div>
    </div>
  );
}
