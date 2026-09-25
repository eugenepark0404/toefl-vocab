'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PART_OF_SPEECH_OPTIONS, type PartOfSpeech } from '@/lib/types';

interface DerivedRow {
  pos: PartOfSpeech;
  word: string;
}

interface SavedNotice {
  headword: string;
  unmatchedExamples: number;
}

const EMPTY_DERIVED: DerivedRow = { pos: 'n', word: '' };

export default function WordForm() {
  const router = useRouter();
  const [headword, setHeadword] = useState('');
  const [meaningKo, setMeaningKo] = useState('');
  const [testPoint, setTestPoint] = useState('');
  const [synonyms, setSynonyms] = useState<string[]>(['']);
  const [derivedWords, setDerivedWords] = useState<DerivedRow[]>([{ ...EMPTY_DERIVED }]);
  const [examples, setExamples] = useState<string[]>(['']);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedNotice | null>(null);

  const updateAt = <T,>(arr: T[], i: number, value: T) => {
    const copy = [...arr];
    copy[i] = value;
    return copy;
  };
  // Never remove the last row: an empty form with no inputs left is a dead end.
  const removeAt = <T,>(arr: T[], i: number, empty: T) => {
    const next = arr.filter((_, idx) => idx !== i);
    return next.length > 0 ? next : [empty];
  };

  function resetForm() {
    setHeadword('');
    setMeaningKo('');
    setTestPoint('');
    setSynonyms(['']);
    setDerivedWords([{ ...EMPTY_DERIVED }]);
    setExamples(['']);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSaved(null);

    if (!headword.trim() || !meaningKo.trim()) {
      setErrorMsg('표제어와 뜻은 필수입니다.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headword: headword.trim(),
          meaning_ko: meaningKo.trim(),
          test_point: testPoint.trim() || undefined,
          synonyms: synonyms.map((s) => s.trim()).filter(Boolean),
          derived_words: derivedWords.filter((d) => d.word.trim()),
          examples: examples.map((s) => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '등록에 실패했습니다.');

      // Stay on the form rather than navigating away: words are usually added
      // several at a time, straight from a vocabulary book.
      setSaved({ headword: headword.trim(), unmatchedExamples: data.unmatchedExamples ?? 0 });
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
        <div
          className="card"
          style={{ background: '#f0fdf4', borderColor: '#86efac', marginBottom: 0 }}
        >
          <strong style={{ fontSize: '0.9rem' }}>&quot;{saved.headword}&quot; 등록 완료</strong>
          {saved.unmatchedExamples > 0 && (
            <p style={{ color: '#92400e', fontSize: '0.85rem', marginTop: 6, lineHeight: 1.6 }}>
              예문 {saved.unmatchedExamples}개에서 표제어를 자동으로 찾지 못했습니다(불규칙
              활용 등). 해당 예문은 카드에는 그대로 보이지만 빈칸 채우기 문제로는 출제되지
              않습니다.
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
          placeholder="e.g. ubiquitous"
        />
      </div>

      <div>
        <label className="label">뜻 (한국어) *</label>
        <input
          className="input"
          value={meaningKo}
          onChange={(e) => setMeaningKo(e.target.value)}
          placeholder="어디에나 있는, 편재하는"
        />
      </div>

      <div>
        <label className="label">동의어</label>
        {synonyms.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <input
              className="input"
              value={s}
              onChange={(e) => setSynonyms(updateAt(synonyms, i, e.target.value))}
              placeholder="e.g. omnipresent"
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSynonyms(removeAt(synonyms, i, ''))}
            >
              삭제
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-secondary" onClick={() => setSynonyms([...synonyms, ''])}>
          + 동의어 추가
        </button>
      </div>

      <div>
        <label className="label">파생어</label>
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
              placeholder="e.g. ubiquity"
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

      <div>
        <label className="label">예문</label>
        <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 6, lineHeight: 1.6 }}>
          문장 속 표제어(또는 복수형·-ing·-ed 같은 규칙 활용형)는 저장할 때 자동으로
          인식되어 빈칸 채우기 문제가 됩니다. 불규칙 활용은 인식되지 않을 수 있으며, 그런
          예문은 빈칸 문제에서 제외되고 등록 직후 안내해 드립니다.
        </p>
        {examples.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <textarea
              className="input"
              rows={2}
              value={s}
              onChange={(e) => setExamples(updateAt(examples, i, e.target.value))}
              placeholder="e.g. Smartphones have become ubiquitous in modern life."
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setExamples(removeAt(examples, i, ''))}
            >
              삭제
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-secondary" onClick={() => setExamples([...examples, ''])}>
          + 예문 추가
        </button>
      </div>

      <div>
        <label className="label">출제포인트 (선택)</label>
        <input
          className="input"
          value={testPoint}
          onChange={(e) => setTestPoint(e.target.value)}
          placeholder="단어장에 있으면 작성, 없으면 비워두세요"
        />
      </div>

      <button className="btn" type="submit" disabled={submitting}>
        {submitting ? '등록 중...' : '단어 등록'}
      </button>
    </form>
  );
}
