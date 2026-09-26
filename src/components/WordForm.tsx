'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PART_OF_SPEECH_OPTIONS, type PartOfSpeech } from '@/lib/types';

interface DerivedRow {
  pos: PartOfSpeech;
  word: string;
}

interface SenseRow {
  meaning: string;
  testPoint: string;
  synonyms: string[];
  examples: string[];
}

interface SavedNotice {
  headword: string;
  senseCount: number;
  unmatchedExamples: number;
}

const EMPTY_DERIVED: DerivedRow = { pos: 'n', word: '' };
const emptySense = (): SenseRow => ({ meaning: '', testPoint: '', synonyms: [''], examples: [''] });

export default function WordForm() {
  const router = useRouter();
  const [headword, setHeadword] = useState('');
  const [derivedWords, setDerivedWords] = useState<DerivedRow[]>([{ ...EMPTY_DERIVED }]);
  const [senses, setSenses] = useState<SenseRow[]>([emptySense()]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedNotice | null>(null);

  const updateAt = <T,>(arr: T[], i: number, value: T) => arr.map((v, idx) => (idx === i ? value : v));
  // Never remove the last row: an empty form with no inputs left is a dead end.
  const removeAt = <T,>(arr: T[], i: number, empty: T) => {
    const next = arr.filter((_, idx) => idx !== i);
    return next.length > 0 ? next : [empty];
  };

  /** Edit one field of one sense without disturbing the others. */
  function patchSense(index: number, patch: Partial<SenseRow>) {
    setSenses((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function resetForm() {
    setHeadword('');
    setDerivedWords([{ ...EMPTY_DERIVED }]);
    setSenses([emptySense()]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSaved(null);

    const filledSenses = senses.filter((s) => s.meaning.trim());
    if (!headword.trim()) {
      setErrorMsg('표제어는 필수입니다.');
      return;
    }
    if (filledSenses.length === 0) {
      setErrorMsg('뜻을 최소 한 개는 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headword: headword.trim(),
          derived_words: derivedWords.filter((d) => d.word.trim()),
          senses: filledSenses.map((s) => ({
            meaning_ko: s.meaning.trim(),
            test_point: s.testPoint.trim() || undefined,
            synonyms: s.synonyms.map((x) => x.trim()).filter(Boolean),
            examples: s.examples.map((x) => x.trim()).filter(Boolean),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '등록에 실패했습니다.');

      // Stay on the form rather than navigating away: words are usually added
      // several at a time, straight from a vocabulary book.
      setSaved({
        headword: headword.trim(),
        senseCount: filledSenses.length,
        unmatchedExamples: data.unmatchedExamples ?? 0,
      });
      resetForm();
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.25rem' }}>
      {errorMsg && <div style={{ color: '#dc2626', fontSize: '0.9rem' }}>{errorMsg}</div>}

      {saved && (
        <div className="card" style={{ background: '#f0fdf4', borderColor: '#86efac', marginBottom: 0 }}>
          <strong style={{ fontSize: '0.9rem' }}>
            &quot;{saved.headword}&quot; 등록 완료 (뜻 {saved.senseCount}개)
          </strong>
          {saved.unmatchedExamples > 0 && (
            <p style={{ color: '#92400e', fontSize: '0.85rem', marginTop: 6, lineHeight: 1.6 }}>
              예문 {saved.unmatchedExamples}개에서 표제어를 자동으로 찾지 못했습니다(불규칙 활용
              등). 해당 예문은 카드에는 그대로 보이지만 빈칸 채우기 문제로는 출제되지 않습니다.
            </p>
          )}
          <p style={{ fontSize: '0.85rem', marginTop: 6 }}>
            <a href="/words" style={{ color: '#2563eb' }}>
              등록된 단어 보기
            </a>
          </p>
        </div>
      )}

      <div>
        <label className="label">표제어 (영어단어) *</label>
        <input
          className="input"
          value={headword}
          autoFocus
          onChange={(e) => setHeadword(e.target.value)}
        />
        <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 4 }}>
          account for 처럼 두 단어 이상도 됩니다.
        </p>
      </div>

      {/* Each sense is its own block: one meaning, with the synonyms and
          examples that belong to that meaning and no other. */}
      {senses.map((sense, si) => (
        <div
          key={si}
          className="card"
          style={{ marginBottom: 0, background: '#fbfbfb', display: 'grid', gap: '1rem' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '0.95rem' }}>뜻 {si + 1}</strong>
            {senses.length > 1 && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', color: '#dc2626' }}
                onClick={() => setSenses(removeAt(senses, si, emptySense()))}
              >
                이 뜻 삭제
              </button>
            )}
          </div>

          <div>
            <label className="label">뜻 (한국어) *</label>
            <input
              className="input"
              value={sense.meaning}
              onChange={(e) => patchSense(si, { meaning: e.target.value })}
            />
          </div>

          <div>
            <label className="label">이 뜻의 동의어</label>
            {sense.synonyms.map((syn, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input
                  className="input"
                  value={syn}
                  onChange={(e) => patchSense(si, { synonyms: updateAt(sense.synonyms, i, e.target.value) })}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => patchSense(si, { synonyms: removeAt(sense.synonyms, i, '') })}
                >
                  삭제
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => patchSense(si, { synonyms: [...sense.synonyms, ''] })}
            >
              + 동의어 추가
            </button>
          </div>

          <div>
            <label className="label">이 뜻의 예문</label>
            {sense.examples.map((ex, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <textarea
                  className="input"
                  rows={2}
                  value={ex}
                  onChange={(e) => patchSense(si, { examples: updateAt(sense.examples, i, e.target.value) })}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => patchSense(si, { examples: removeAt(sense.examples, i, '') })}
                >
                  삭제
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => patchSense(si, { examples: [...sense.examples, ''] })}
            >
              + 예문 추가
            </button>
          </div>

          <div>
            <label className="label">이 뜻의 출제포인트 (선택)</label>
            <input
              className="input"
              value={sense.testPoint}
              onChange={(e) => patchSense(si, { testPoint: e.target.value })}
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => setSenses([...senses, emptySense()])}
      >
        + 다른 뜻 추가
      </button>

      <div>
        <label className="label">파생어</label>
        <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 6 }}>
          뜻과 상관없이 단어 전체에 적용됩니다.
        </p>
        {derivedWords.map((d, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <select
              className="input"
              style={{ maxWidth: 140 }}
              value={d.pos}
              onChange={(e) =>
                setDerivedWords(updateAt(derivedWords, i, { ...d, pos: e.target.value as PartOfSpeech }))
              }
            >
              {PART_OF_SPEECH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              className="input"
              value={d.word}
              onChange={(e) => setDerivedWords(updateAt(derivedWords, i, { ...d, word: e.target.value }))}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDerivedWords(removeAt(derivedWords, i, { ...EMPTY_DERIVED }))}
            >
              삭제
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setDerivedWords([...derivedWords, { ...EMPTY_DERIVED }])}
        >
          + 파생어 추가
        </button>
      </div>

      <p style={{ fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.6 }}>
        예문 속 표제어는 저장할 때 자동으로 인식되어 빈칸 채우기 문제가 됩니다. 뜻마다 별점이
        따로 매겨지고 시험도 뜻 단위로 출제됩니다.
      </p>

      <button className="btn" type="submit" disabled={submitting}>
        {submitting ? '등록 중...' : '단어 등록'}
      </button>
    </form>
  );
}
