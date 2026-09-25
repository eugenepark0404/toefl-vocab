import { NextResponse } from 'next/server';
import { getDb, type AttemptInput } from '@/lib/db';
import { calculateDifficultyStars } from '@/lib/difficulty';

interface SubmitBody {
  sessionId: string;
  answers: AttemptInput[];
}

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: SubmitBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
  }

  if (!body.sessionId || !Array.isArray(body.answers)) {
    return NextResponse.json({ error: 'sessionId와 answers가 필요합니다.' }, { status: 400 });
  }

  try {
    const db = getDb();
    await db.recordAttempts(body.sessionId, body.answers);
    await db.completeExamSession(body.sessionId);

    // Recalculate stars for every word in this sitting, using its full history.
    const wordIds = Array.from(new Set(body.answers.map((a) => a.wordId)));
    const updated = await Promise.all(
      wordIds.map(async (wordId) => {
        const history = await db.getAttemptHistory(wordId);
        const stars = calculateDifficultyStars(history);
        await db.updateWordStars(wordId, stars);
        return { wordId, stars };
      })
    );

    return NextResponse.json({ ok: true, updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? '채점에 실패했습니다.' }, { status: 500 });
  }
}
