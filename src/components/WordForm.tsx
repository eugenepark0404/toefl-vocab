'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PART_OF_SPEECH_OPTIONS, type PartOfSpeech, type Word } from '@/lib/types';

interface DerivedRow {
  pos: PartOfSpeech;
  word: string;
}

interface SenseRow {
  /** Present for a meaning that already exists, so editing keeps its rating. */
  id?: string;
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

interface Props {
  /** Omitted when registering; supplied when editing an existing word. */
  word?: Word;
  /**
   * Every other word's headword, lowercased. Used to warn about a clash while
   * typing rather than only after the whole form has been filled in. The
   * server checks again on save; this is convenience, not enforcement.
   */
  existingHeadwords?: string[];
}

const EMPTY_DERIVED: DerivedRow = { pos: 'n', word: '' };
const emptySense = (): SenseRow => ({ meaning: '', testPoint: '', synonyms: [''], examples: [''] });

/** Keep at least one blank row so a list can never become uneditable. */
const orBlank = (rows: string[]) => (rows.length > 0 ? rows : ['']);

function toRows(word: Word): { derived: DerivedRow[]; senses: SenseRow[] } {
  return {
    derived:
      word.derived_words.length > 0
        ? word.derived_words.map((d) => ({ pos: d.pos, word: d.derived_word }))
        : [{ ...EMPTY_DERIVED }],
    senses: word.senses.map((s) => ({
      id: s.id,
      meaning: s.meaning_ko,
      testPoint: s.test_point ?? '',
      synonyms: orBlank(s.synonyms.map((x) => x.synonym)),
      examples: orBlank(s.examples.map((x) => x.sentence)),
    })),
  };
}

export default function WordForm({ word, existingHeadwords = [] }: Props) {
  const router = useRouter();
  const isEdit = Boolean(word);
  const initial = word ? toRows(word) : null;

  const [headword, setHeadword] = useState(word?.headword ?? '');
  const [derivedWords, setDerivedWords] = useState<DerivedRow[]>(
    initial?.derived ?? [{ ...EMPTY_DERIVED }]
  );
  const [senses, setSenses] = useState<SenseRow[]>(initial?.senses ?? [emptySense()]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedNotice | null>(null);

  // Warn as soon as the headword is recognised, instead of letting the whole
  // form be filled in and then rejected on save.
  const duplicateWarning = useMemo(() => {
    const typed = headword.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!typed) return null;
    return existingHeadwords.includes(typed) ? typed : null;
  }, [headword, existingHeadwords]);

  const updateAt = <T,>(arr: T[], i: number, value: T) => arr.map((v, idx) => (idx === i ? value : v));
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
    if (!headword.trim()) return fail('표제어는 필수입니다.');
    if (filledSenses.length === 0) return fail('뜻을 최소 한 개는 입력해주세요.');
    if (!isEdit && duplicateWarning) {
      return fail(`"${headword.trim()}"는 이미 등록된 단어입니다. 기존 단어를 수정해주세요.`);
    }

    setSubmitting(true);
    try {
      const res = await fetch(isEdit ? `/api/words/${word!.id}` : '/api/words', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headword: headword.trim(),
          derived_words: derivedWords.filter((d) => d.word.trim()),
          senses: filledSenses.map((s) => ({
            id: s.id,
            meaning_ko: s.meaning.trim(),
            test_point: s.testPoint.trim() || undefined,
            synonyms: s.synonyms.map((x) => x.trim()).filter(Boolean),
            examples: s.examples.map((x) => x.trim()).filter(Boolean),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '저장에 실패했습니다.');

      if (isEdit) {
        router.push('/words');
        router.refresh();
        return;
      }

      // Stay on the form rather than navigating away: words are usually added
      // several at a time, straight from a vocabulary book.
      setSaved({
        headword: headword.trim(),
        senseCount: filledSenses.length,
        unmatchedExamples: data.unmatchedExamples ?? 0,
      });
      resetForm();
      router.refresh();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      fail(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  /** Show the problem and put it on screen. The form is long enough that a
   *  message pinned to the top would otherwise be missed entirely, making a
   *  refused save look like nothing happened at all. */
  function fail(message: string) {
    setErrorMsg(message);
    setSubmitting(false);
  }

  const ErrorBanner = () =>
    errorMsg ? (
      <div
        className="card"
        style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#b91c1c', marginBottom: 0 }}
      >
        {errorMsg}
      </div>
    ) : null;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.25rem' }}>
      <ErrorBanner />

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
          style={duplicateWarning ? { borderColor: '#f87171' } : undefined}
        />
        {duplicateWarning ? (
          <p style={{ fontSize: '0.85rem', color: '#b91c1c', marginTop: 4 }}>
            이미 등록된 단어입니다. 새로 저장할 수 없으니,{' '}
            <a href="/words" style={{ color: '#2563eb' }}>
              등록된 단어
            </a>
            에서 찾아 수정해주세요.
          </p>
        ) : (
          <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 4 }}>
            account for 처럼 두 단어 이상도 됩니다.
          </p>
        )}
      </div>

      {/* Each sense is its own block: one meaning, with the synonyms and
          examples that belong to that meaning and no other. */}
      {senses.map((sense, si) => (
        <div
          key={sense.id ?? `new-${si}`}
          className="card"
          style={{ marginBottom: 0, background: '#fbfbfb', display: 'grid', gap: '1rem' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '0.95rem' }}>
              뜻 {si + 1}
              {isEdit && !sense.id && (
                <span style={{ color: '#2563eb', fontSize: '0.75rem', marginLeft: 6 }}>새로 추가</span>
              )}
            </strong>
            {senses.length > 1 && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', color: '#dc2626' }}
                onClick={() => {
                  if (
                    sense.id &&
                    !confirm('이 뜻을 삭제하면 해당 뜻의 별점과 시험 기록도 함께 사라집니다. 삭제할까요?')
                  ) {
                    return;
                  }
                  setSenses(removeAt(senses, si, emptySense()));
                }}
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
        {isEdit
          ? '기존 뜻을 고쳐도 그 뜻의 별점과 시험 기록은 유지됩니다. 뜻을 삭제하면 해당 기록도 사라집니다.'
          : '예문 속 표제어는 저장할 때 자동으로 인식되어 빈칸 채우기 문제가 됩니다. 뜻마다 별점이 따로 매겨지고 시험도 뜻 단위로 출제됩니다.'}
      </p>

      {/* Repeated next to the button: on a form this long the banner at the
          top is off-screen when the button is pressed. */}
      <ErrorBanner />

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn"
          type="submit"
          disabled={submitting || (!isEdit && Boolean(duplicateWarning))}
        >
          {submitting ? '저장 중...' : isEdit ? '수정 저장' : '단어 등록'}
        </button>
        {isEdit && (
          <a href="/words" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
            취소
          </a>
        )}
      </div>
    </form>
  );
}
