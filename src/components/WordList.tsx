'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { worstStars, type Word } from '@/lib/types';
import WordCard from '@/components/WordCard';
import SeedButton from '@/components/SeedButton';

type StarFilter = 'all' | 1 | 2 | 3;

const STAR_FILTERS: { value: StarFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 3, label: '★★★ 낯섦' },
  { value: 2, label: '★★☆ 애매함' },
  { value: 1, label: '★☆☆ 암기 완료' },
];

/**
 * The word list, with search and a star filter. Both run on the client over
 * the already-loaded list: a personal vocabulary is small enough that a round
 * trip per keystroke would be slower than filtering in place.
 */
export default function WordList({ words }: { words: Word[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [starFilter, setStarFilter] = useState<StarFilter>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return words.filter((w) => {
      // Filter on the least-known sense, which is what the badge shows.
      if (starFilter !== 'all' && worstStars(w) !== starFilter) return false;
      if (!q) return true;
      // Search the headword, the Korean meaning and the synonyms, so you can
      // find a card from whichever side you happen to remember.
      return (
        w.headword.toLowerCase().includes(q) ||
        w.senses.some(
          (sense) =>
            sense.meaning_ko.toLowerCase().includes(q) ||
            sense.synonyms.some((s) => s.synonym.toLowerCase().includes(q))
        )
      );
    });
  }, [words, query, starFilter]);

  async function handleDelete(word: Word) {
    if (!confirm(`"${word.headword}"를 삭제할까요? 시험 기록도 함께 삭제됩니다.`)) return;
    setDeletingId(word.id);
    try {
      const res = await fetch(`/api/words/${word.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? '삭제에 실패했습니다.');
      }
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  if (words.length === 0) {
    return (
      <div>
        <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
          아직 등록된 단어가 없습니다.
        </p>
        <SeedButton />
      </div>
    );
  }

  return (
    <div>
      <input
        className="input"
        style={{ marginBottom: 10 }}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="표제어 · 뜻 · 동의어 검색"
      />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {STAR_FILTERS.map((f) => (
          <button
            key={String(f.value)}
            className="btn btn-secondary"
            style={{
              fontSize: '0.8rem',
              padding: '0.35rem 0.7rem',
              background: starFilter === f.value ? '#111827' : 'white',
              color: starFilter === f.value ? 'white' : '#111827',
            }}
            onClick={() => setStarFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p style={{ color: '#6b7280' }}>조건에 맞는 단어가 없습니다.</p>
      ) : (
        visible.map((w) => (
          <WordCard
            key={w.id}
            word={w}
            onDelete={() => handleDelete(w)}
            deleting={deletingId === w.id}
          />
        ))
      )}
    </div>
  );
}
