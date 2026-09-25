'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Shown only when the vocabulary is empty. Loading sample words is opt-in so
 * that a real vocabulary never ends up mixed with demo data.
 */
export default function SeedButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadSamples() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '샘플 단어를 불러오지 못했습니다.');
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ background: '#f8fafc' }}>
      <strong style={{ fontSize: '0.9rem' }}>먼저 둘러보고 싶다면</strong>
      <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '6px 0 10px', lineHeight: 1.6 }}>
        TOEFL 빈출 단어 20개를 예문·동의어·출제포인트까지 채워서 불러옵니다. 바로 오늘의
        단어와 시험을 시험해 볼 수 있어요. 나중에 개별 삭제할 수 있습니다.
      </p>
      {errorMsg && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: 8 }}>{errorMsg}</p>}
      <button className="btn" onClick={loadSamples} disabled={loading}>
        {loading ? '불러오는 중...' : '샘플 단어 20개 불러오기'}
      </button>
    </div>
  );
}
