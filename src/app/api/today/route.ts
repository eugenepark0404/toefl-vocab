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
 * Words shown earlier today are logged and skipped, so pressing the button
 * again continues through the list instead of restarting it.
 */
export async function GET() {
  try {
    const db = getDb();
    const day = localDay();

    const [shownIds, eligible] = await Promise.all([
      db.getTodayShownWordIds(day),
      db.listWordsByStars([2, 3]),
    ]);

    const shown = new Set(shownIds);
    const selected = eligible.filter((w) => !shown.has(w.id)).slice(0, DAILY_COUNT);

    if (selected.length > 0) {
      await db.logTodayShown(
        selected.map((w) => w.id),
        day
      );
    }

    return NextResponse.json({
      words: selected,
      totalEligible: eligible.length,
      // Lets the page tell "nothing to study" apart from "you already did it today".
      alreadyShownToday: eligible.filter((w) => shown.has(w.id)).length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
