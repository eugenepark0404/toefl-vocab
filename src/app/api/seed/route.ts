import { NextResponse } from 'next/server';
import { getDb, DuplicateHeadwordError } from '@/lib/db';
import { buildWordRecord, planQuestions } from '@/lib/wordService';
import { SEED_WORDS } from '@/lib/seedWords';

export const dynamic = 'force-dynamic';

/**
 * Load the starter vocabulary.
 *
 * Runs through the same code path as manual registration, so seeded words get
 * the same auto-generated questions. Words that already exist are skipped
 * rather than treated as failures, which makes the call safe to repeat.
 */
export async function POST() {
  const db = getDb();
  let added = 0;
  let skipped = 0;

  try {
    for (const input of SEED_WORDS) {
      const record = buildWordRecord(input);
      try {
        await db.createWord(record, planQuestions(record));
        added++;
      } catch (err) {
        if (err instanceof DuplicateHeadwordError) {
          skipped++;
          continue;
        }
        throw err;
      }
    }
    return NextResponse.json({ added, skipped });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? '샘플 단어를 불러오지 못했습니다.', added, skipped },
      { status: 500 }
    );
  }
}
