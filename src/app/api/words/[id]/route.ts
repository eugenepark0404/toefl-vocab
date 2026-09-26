import { NextResponse } from 'next/server';
import { getDb, DuplicateHeadwordError } from '@/lib/db';
import { buildWordRecord, unmatchedExampleCount } from '@/lib/wordService';
import type { WordFormInput } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const word = await getDb().getWord(params.id);
    if (!word) return NextResponse.json({ error: '단어를 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json({ word });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Replace a word's content.
 *
 * Meanings sent with an `id` are updated in place and keep their star rating
 * and exam history; ones without are added; ones left out are removed.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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
    const word = await getDb().updateWord(params.id, record);
    return NextResponse.json({ word, unmatchedExamples: unmatchedExampleCount(record) });
  } catch (err: any) {
    if (err instanceof DuplicateHeadwordError) {
      return NextResponse.json(
        { error: `"${record.headword}"는 이미 등록된 다른 단어입니다.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: err.message ?? '수정에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await getDb().deleteWord(params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
