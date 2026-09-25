'use client';

import { useState } from 'react';
import type { Word } from '@/lib/types';
import { PART_OF_SPEECH_OPTIONS } from '@/lib/types';

function posLabel(pos: string) {
  return PART_OF_SPEECH_OPTIONS.find((o) => o.value === pos)?.label ?? pos;
}

export default function FlashCard({ word }: { word: Word }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      onClick={() => setFlipped(!flipped)}
      className="card"
      style={{ minHeight: 220, cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
    >
      {!flipped ? (
        <div style={{ textAlign: 'center', fontSize: '1.6rem', fontWeight: 700 }}>{word.headword}</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          <div>
            <div className="label">뜻</div>
            <div>{word.meaning_ko}</div>
          </div>
          {word.synonyms.length > 0 && (
            <div>
              <div className="label">동의어</div>
              <div>{word.synonyms.map((s) => s.synonym).join(', ')}</div>
            </div>
          )}
          {word.derived_words.length > 0 && (
            <div>
              <div className="label">파생어</div>
              <div>
                {word.derived_words.map((d) => `${d.derived_word}(${posLabel(d.pos)})`).join(', ')}
              </div>
            </div>
          )}
          {word.examples.length > 0 && (
            <div>
              <div className="label">예문</div>
              <div>{word.examples[0].sentence}</div>
            </div>
          )}
          {word.test_point && (
            <div>
              <div className="label">출제포인트</div>
              <div>{word.test_point}</div>
            </div>
          )}
        </div>
      )}
      <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.75rem', marginTop: 12 }}>
        카드를 눌러 {flipped ? '앞면' : '뒷면'}으로
      </p>
    </div>
  );
}
