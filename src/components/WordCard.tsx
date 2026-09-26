'use client';

import { useState } from 'react';
import type { Word } from '@/lib/types';
import { PART_OF_SPEECH_OPTIONS, meaningSummary, worstStars } from '@/lib/types';
import SenseDetail, { starsLabel } from '@/components/SenseDetail';

function posLabel(pos: string) {
  return PART_OF_SPEECH_OPTIONS.find((o) => o.value === pos)?.label ?? pos;
}

interface Props {
  word: Word;
  onDelete?: () => void;
  deleting?: boolean;
}

/** Collapsed: headword, all meanings, worst star. Expanded: each sense in full. */
export default function WordCard({ word, onDelete, deleting }: Props) {
  const [open, setOpen] = useState(false);
  const senseCount = word.senses.length;

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
          {senseCount > 1 && (
            <span
              style={{
                fontSize: '0.7rem',
                background: '#eef2ff',
                color: '#4338ca',
                borderRadius: 4,
                padding: '2px 5px',
                marginLeft: 6,
              }}
            >
              뜻 {senseCount}
            </span>
          )}
          <span style={{ color: '#6b7280', marginLeft: 10 }}>{meaningSummary(word)}</span>
        </div>
        {/* The worst sense sets the badge: a word is only "known" once every
            meaning of it is. */}
        <span className="stars" style={{ whiteSpace: 'nowrap' }}>
          {starsLabel(worstStars(word))}
        </span>
      </button>

      {open && (
        <div
          style={{
            marginTop: 12,
            borderTop: '1px solid #e5e7eb',
            paddingTop: 12,
            display: 'grid',
            gap: 12,
          }}
        >
          {word.senses.map((sense, i) => (
            <SenseDetail key={sense.id} sense={sense} index={i} total={senseCount} />
          ))}

          {word.derived_words.length > 0 && (
            <div style={{ borderTop: '1px dashed #e5e7eb', paddingTop: 12 }}>
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

          <div style={{ display: 'flex', gap: 8 }}>
            <a
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem', textDecoration: 'none' }}
              href={`/words/${word.id}/edit`}
            >
              수정
            </a>
            {onDelete && (
              <button
                className="btn btn-secondary"
                style={{ color: '#dc2626', fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}
                onClick={onDelete}
                disabled={deleting}
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
