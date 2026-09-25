import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const DAILY_COUNT = 30;

/** Today in the server's local timezone. `toISOString()` would use UTC, which
 *  rolls the day over mid-morning in Asia/Seoul and would reset the log early. */
function localDay(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

/**
 * Today's words: up to 30 cards drawn from words currently at 2 or 3 stars.
 *
 * Reading this is idempotent. A batch, once chosen, is returned again on every
 * later call, so refreshing the page - or React running the effect twice in
 * development - replays the same cards instead of consuming them. An earlier
 * version logged words as "shown" simply because the page had loaded, so the
 * second call of the day returned nothing and the screen claimed the review
 * was already finished.
 *
 * Moving on is therefore explicit: `?next=1` opens the next batch. Replaying
 * returns only the current batch, not everything seen today, so a refresh in
 * the middle of round two does not silently reopen round one.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    const day = localDay();
    const wantsNextBatch = new URL(req.url).searchParams.get('next') === '1';

    const [log, eligible] = await Promise.all([
      db.getTodayLog(day),
      db.listWordsByStars([2, 3]),
    ]);

    const seen = new Set(log.map((e) => e.wordId));
    const unseen = eligible.filter((w) => !seen.has(w.id));
    const currentBatch = log.reduce((max, e) => Math.max(max, e.batch), 0);

    if (currentBatch > 0 && !wantsNextBatch) {
      const batchIds = log.filter((e) => e.batch === currentBatch).map((e) => e.wordId);
      const words = await db.listWordsByIds(batchIds);
      return NextResponse.json({
        words,
        totalEligible: eligible.length,
        remaining: unseen.length,
        batch: currentBatch,
        isReplay: true,
      });
    }

    const batch = currentBatch + 1;
    const selected = unseen.slice(0, DAILY_COUNT);
    if (selected.length > 0) {
      await db.logTodayShown(
        selected.map((w) => w.id),
        day,
        batch
      );
    }

    return NextResponse.json({
      words: selected,
      totalEligible: eligible.length,
      // What is left after this batch, so the page can offer another round.
      remaining: unseen.length - selected.length,
      batch,
      isReplay: false,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
