import Link from 'next/link';
import SeedButton from '@/components/SeedButton';
import { getDb, storageBackend } from '@/lib/db';
import { worstStars, type Word } from '@/lib/types';

export const dynamic = 'force-dynamic';

const LINKS = [
  { href: '/words/new', title: '단어 등록', desc: '한 단어에 여러 뜻을 등록하고, 뜻마다 동의어와 예문을 붙입니다.' },
  { href: '/today', title: '오늘의 단어', desc: '별 2~3개인 뜻이 있는 단어를 카드 퀴즈(최대 30개)로 복습합니다.' },
  { href: '/exam', title: '시험', desc: '뜻 단위로 별점 가중치를 반영해 하루 45문제를 출제합니다.' },
  { href: '/words', title: '등록된 단어', desc: '지금까지 등록한 모든 단어를 검색하고 확인합니다.' },
];

export default async function HomePage() {
  const backend = storageBackend();

  let words: Word[] = [];
  let errorMsg: string | null = null;
  try {
    words = await getDb().listWords();
  } catch (err: any) {
    errorMsg = err.message;
  }

  const dueToday = words.filter((w) => worstStars(w) >= 2).length;

  return (
    <div>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>TOEFL 단어장</h1>

      {errorMsg ? (
        <p style={{ color: '#dc2626', marginBottom: '1.5rem' }}>{errorMsg}</p>
      ) : (
        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          등록된 단어 {words.length}개 · 뜻 {words.reduce((n, w) => n + w.senses.length, 0)}개 ·
          복습 대상 {dueToday}개
        </p>
      )}

      {!errorMsg && words.length === 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <SeedButton />
        </div>
      )}

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="card"
            style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
          >
            <strong>{link.title}</strong>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: 4 }}>{link.desc}</p>
          </Link>
        ))}
      </div>

      {/* Where the data is going should never be a surprise: local mode is
          single-machine and will not sync to a phone. */}
      {backend === 'local' && (
        <div
          className="card"
          style={{ marginTop: '1.5rem', background: '#fffbeb', borderColor: '#fcd34d' }}
        >
          <strong style={{ fontSize: '0.9rem' }}>로컬 저장 모드</strong>
          <p style={{ color: '#92400e', fontSize: '0.85rem', marginTop: 4, lineHeight: 1.6 }}>
            지금은 이 컴퓨터의 <code>.data/toefl-vocab.json</code> 파일에 저장되고 있습니다.
            바로 써볼 수 있지만 다른 기기와 동기화되지는 않습니다. 핸드폰에서도 같은 단어를
            보려면 README의 &quot;Sync across devices&quot; 절을 따라 Supabase를 연결하세요.
          </p>
        </div>
      )}
    </div>
  );
}
