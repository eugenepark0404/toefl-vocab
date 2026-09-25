'use client';

import { useEffect, useState } from 'react';
import type { Word } from '@/lib/types';
import FlashCard from '@/components/FlashCard';

interface TodayResponse {
  words: Word[];
  totalEligible: number;
  alreadyShownToday: number;
  error?: string;
}

export default function TodayPage() {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/today')
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? '불러오지 못했습니다.');
        return body as TodayResponse;
      })
      .then(setData)
      .catch((err) => setErrorMsg(err.message));
  }, []);

  if (errorMsg) return <p style={{ color: '#dc2626' }}>{errorMsg}</p>;
  if (!data) return <p>불러오는 중...</p>;

  const words = data.words;

  if (words.length === 0) {
    // "Nothing left today" and "nothing to study at all" need different advice.
    return (
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>오늘의 단어</h1>
        {data.alreadyShownToday > 0 ? (
          <p style={{ color: '#6b7280' }}>
            오늘 복습할 단어를 모두 확인했습니다 ({data.alreadyShownToday}개). 내일 다시
            만나요.
          </p>
        ) : (
          <p style={{ color: '#6b7280' }}>
            복습할 단어가 없습니다. 별 2~3개인 단어가 대상이며, 단어를 새로 등록하거나
            시험을 보면 별점이 갱신됩니다.
          </p>
        )}
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
        <div style={{ display: 'grid', gap: 10 }}>
          {words.map((w) => (
            <div key={w.id} className="card">
              <strong>{w.headword}</strong>
              <span style={{ color: '#6b7280', marginLeft: 10 }}>{w.meaning_ko}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const current = words[index];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>오늘의 단어</h1>
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
