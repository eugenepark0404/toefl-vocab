import WordList from '@/components/WordList';
import { getDb } from '@/lib/db';
import type { Word } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function WordsPage() {
  let words: Word[] = [];
  let errorMsg: string | null = null;

  try {
    words = await getDb().listWords();
  } catch (err: any) {
    errorMsg = err.message;
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem' }}>
        등록된 단어 ({words.length})
      </h1>
      {errorMsg ? (
        <p style={{ color: '#dc2626' }}>{errorMsg}</p>
      ) : (
        <WordList words={words} />
      )}
    </div>
  );
}
