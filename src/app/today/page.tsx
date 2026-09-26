'use client';

import { useCallback, useEffect, useState } from 'react';
import { meaningSummary, type Word } from '@/lib/types';
import FlashCard from '@/components/FlashCard';

interface TodayResponse {
  words: Word[];
  totalEligible: number;
  remaining: number;
  batch: number;
  isReplay: boolean;
}

export default function TodayPage() {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async (nextBatch: boolean) => {
    const res = await fetch(`/api/today${nextBatch ? '?next=1' : ''}`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? '불러오지 못했습니다.');
    return body as TodayResponse;
  }, []);

  useEffect(() => {
    let cancelled = false;
    load(false)
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((err) => {
        if (!cancelled) setErrorMsg(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function loadNextBatch() {
    setLoadingNext(true);
    setErrorMsg(null);
    try {
      const body = await load(true);
      setData(body);
      setIndex(0);
      setFinished(false);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoadingNext(false);
    }
  }

  if (errorMsg) return <p style={{ color: '#dc2626' }}>{errorMsg}</p>;
  if (!data) return <p>불러오는 중...</p>;

  const words = data.words;

  if (words.length === 0) {
    return (
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>오늘의 단어</h1>
        <p style={{ color: '#6b7280', lineHeight: 1.7 }}>
          복습할 단어가 없습니다. 별 2~3개인 뜻이 대상이며, 단어를 새로 등록하거나 시험을
          보면 별점이 갱신됩니다.
        </p>
      </div>
    );
  }

  if (finished || index >= words.length) {
    return (
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
          오늘의 단어 완료
        </h1>
        <p style={{ marginBottom: '1rem' }}>오늘 본 단어 {words.length}개를 한 번에 확인하세요.</p>
        <div style={{ display: 'grid', gap: 10, marginBottom: '1.25rem' }}>
          {words.map((w) => (
            <div key={w.id} className="card">
              <strong>{w.headword}</strong>
              <span style={{ color: '#6b7280', marginLeft: 10 }}>{meaningSummary(w)}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => { setIndex(0); setFinished(false); }}>
            다시 보기
          </button>
          {/* Drawing the next batch is deliberate, never a side effect of loading. */}
          {data.remaining > 0 && (
            <button className="btn" onClick={loadNextBatch} disabled={loadingNext}>
              {loadingNext ? '불러오는 중...' : `다음 ${Math.min(30, data.remaining)}개 보기 (남은 단어 ${data.remaining}개)`}
            </button>
          )}
        </div>
      </div>
    );
  }

  const current = words[index];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
          오늘의 단어{data.batch > 1 && ` (${data.batch}회차)`}
        </h1>
        <span style={{ color: '#6b7280' }}>
          {index + 1} / {words.length}
        </span>
      </div>

      <FlashCard key={current.id} word={current} />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
        <button
          className="btn btn-secondary"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          이전
        </button>
        <button
          className="btn"
          onClick={() => (index + 1 >= words.length ? setFinished(true) : setIndex((i) => i + 1))}
        >
          {index + 1 >= words.length ? '완료 · 전체 확인' : '다음'}
        </button>
      </div>
    </div>
  );
}
