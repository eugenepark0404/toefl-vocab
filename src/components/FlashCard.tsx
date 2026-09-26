'use client';

import { useState } from 'react';
import type { Word } from '@/lib/types';
import { PART_OF_SPEECH_OPTIONS } from '@/lib/types';
import SenseDetail from '@/components/SenseDetail';

function posLabel(pos: string) {
  return PART_OF_SPEECH_OPTIONS.find((o) => o.value === pos)?.label ?? pos;
}

/**
 * Review card: headword on the front, every meaning on the back.
 *
 * All senses are shown together rather than one per card. Recalling that
 * "account for" has three meanings is part of knowing the word, and splitting
 * them across cards would give that away by showing the same headword twice
 * in a row.
 */
export default function FlashCard({ word }: { word: Word }) {
  const [flipped, setFlipped] = useState(false);
  const senseCount = word.senses.length;

  return (
    <div
      onClick={() => setFlipped(!flipped)}
      className="card"
      style={{
        minHeight: 220,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      {!flipped ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{word.headword}</div>
          {senseCount > 1 && (
            <div style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: 8 }}>
              뜻 {senseCount}개
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {word.senses.map((sense, i) => (
            <SenseDetail key={sense.id} sense={sense} index={i} total={senseCount} />
          ))}

          {word.derived_words.length > 0 && (
            <div style={{ borderTop: '1px dashed #e5e7eb', paddingTop: 12 }}>
              <div className="label">파생어</div>
              <div>
                {word.derived_words.map((d) => `${d.derived_word}(${posLabel(d.pos)})`).join(', ')}
              </div>
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
