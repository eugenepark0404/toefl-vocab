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
  if (body.answers.some((a) => !a.senseId)) {
    return NextResponse.json({ error: '답안에 senseId가 없습니다.' }, { status: 400 });
  }

  try {
    const db = getDb();
    await db.recordAttempts(body.sessionId, body.answers);
    await db.completeExamSession(body.sessionId);

    // Recalculate stars for every SENSE in this sitting, from its own history.
    // Rating by sense is the point: knowing "account for = 설명하다" says
    // nothing about whether "= 차지하다" has been learned.
    const senseIds = Array.from(new Set(body.answers.map((a) => a.senseId)));
    const updated = await Promise.all(
      senseIds.map(async (senseId) => {
        const history = await db.getSenseAttemptHistory(senseId);
        const stars = calculateDifficultyStars(history);
        await db.updateSenseStars(senseId, stars);
        return { senseId, stars };
      })
    );

    return NextResponse.json({ ok: true, updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? '채점에 실패했습니다.' }, { status: 500 });
  }
}
