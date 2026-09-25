'use client';

import { useState } from 'react';
import type { Word } from '@/lib/types';
import { PART_OF_SPEECH_OPTIONS } from '@/lib/types';

function starsLabel(n: 1 | 2 | 3) {
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}
function posLabel(pos: string) {
  return PART_OF_SPEECH_OPTIONS.find((o) => o.value === pos)?.label ?? pos;
}

interface Props {
  word: Word;
  onDelete?: () => void;
  deleting?: boolean;
}

/** Collapsed: headword, meaning, stars. Expanded: everything else. */
export default function WordCard({ word, onDelete, deleting }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          width: '100%',
        }}
      >
        <div>
          <strong>{word.headword}</strong>
          <span style={{ color: '#6b7280', marginLeft: 10 }}>{word.meaning_ko}</span>
        </div>
        <span className="stars" style={{ whiteSpace: 'nowrap' }}>
          {starsLabel(word.difficulty_stars)}
        </span>
      </button>

      {open && (
        <div
          style={{
            marginTop: 12,
            borderTop: '1px solid #e5e7eb',
            paddingTop: 12,
            display: 'grid',
            gap: 10,
          }}
        >
          {word.synonyms.length > 0 && (
            <div>
              <div className="label">동의어</div>
              <div>{word.synonyms.map((s) => s.synonym).join(', ')}</div>
            </div>
          )}

          {word.derived_words.length > 0 && (
            <div>
              <div className="label">파생어</div>
              <ul style={{ paddingLeft: 18 }}>
                {word.derived_words.map((d) => (
                  <li key={d.id}>
                    {d.derived_word} <span style={{ color: '#6b7280' }}>({posLabel(d.pos)})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {word.examples.length > 0 && (
            <div>
              <div className="label">예문</div>
              <ul style={{ paddingLeft: 18 }}>
                {word.examples.map((ex) => (
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

          {word.test_point && (
            <div>
              <div className="label">출제포인트</div>
              <div>{word.test_point}</div>
            </div>
          )}

          {onDelete && (
            <div>
              <button
                className="btn btn-secondary"
                style={{ color: '#dc2626', fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}
                onClick={onDelete}
                disabled={deleting}
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
