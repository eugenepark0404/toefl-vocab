import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

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

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await getDb().deleteWord(params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Editing a word (PATCH) is not implemented. It is more involved than creating
// one: changing the synonyms or examples means the auto-generated questions
// have to be rebuilt too, and any blank_fill question pointing at a deleted
// example has to go with it. See IMPLEMENTATION_PLAN.md, Phase 2.
