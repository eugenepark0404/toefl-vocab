import WordForm from '@/components/WordForm';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function NewWordPage() {
  // Passed to the form so a headword that already exists is flagged while it
  // is being typed, not after the whole form has been filled in.
  let existingHeadwords: string[] = [];
  try {
    existingHeadwords = (await getDb().listWords()).map((w) =>
      w.headword.trim().replace(/\s+/g, ' ').toLowerCase()
    );
  } catch {
    // The server still rejects duplicates on save, so an unreadable list here
    // costs a nicety, not correctness.
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem' }}>단어 등록</h1>
      <WordForm existingHeadwords={existingHeadwords} />
    </div>
  );
}
