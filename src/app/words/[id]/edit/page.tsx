import { notFound } from 'next/navigation';
import WordForm from '@/components/WordForm';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function EditWordPage({ params }: { params: { id: string } }) {
  const db = getDb();
  const word = await db.getWord(params.id);
  if (!word) notFound();

  // Every OTHER headword, so renaming onto an existing word is caught while
  // typing. The word's own name must not count as a clash with itself.
  const others = (await db.listWords())
    .filter((w) => w.id !== word.id)
    .map((w) => w.headword.trim().replace(/\s+/g, ' ').toLowerCase());

  return (
    <div>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>단어 수정</h1>
      <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.25rem' }}>{word.headword}</p>
      <WordForm word={word} existingHeadwords={others} />
    </div>
  );
}
