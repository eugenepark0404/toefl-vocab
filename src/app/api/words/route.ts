import { NextResponse } from 'next/server';
import { getDb, DuplicateHeadwordError } from '@/lib/db';
import { buildWordRecord, unmatchedExampleCount } from '@/lib/wordService';
import type { WordFormInput } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ words: await getDb().listWords() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: WordFormInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
  }

  if (!body.headword?.trim()) {
    return NextResponse.json({ error: '표제어는 필수입니다.' }, { status: 400 });
  }

  const record = buildWordRecord(body);
  if (record.senses.length === 0) {
    return NextResponse.json({ error: '뜻을 최소 한 개는 입력해주세요.' }, { status: 400 });
  }

  try {
    const word = await getDb().createWord(record);
    return NextResponse.json(
      {
        word,
        // The form surfaces this so a failed auto-match is visible at registration
        // time rather than as a broken question weeks later.
        unmatchedExamples: unmatchedExampleCount(record),
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err instanceof DuplicateHeadwordError) {
      return NextResponse.json(
        { error: `"${record.headword}"는 이미 등록된 단어입니다.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: err.message ?? '단어 등록에 실패했습니다.' }, { status: 500 });
  }
}
