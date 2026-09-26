import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Sense, Word } from '@/lib/types';
import { normaliseHeadword } from '@/lib/wordService';
import {
  DuplicateHeadwordError,
  type AttemptInput,
  type NewSenseRecord,
  type NewWordRecord,
  type SenseForExam,
  type TodayLogEntry,
  type WordRepository,
} from '@/lib/db/types';

/**
 * Zero-setup storage: one JSON file on disk.
 *
 * This is what runs when no Supabase credentials are configured, so a fresh
 * clone works with nothing but `npm install && npm run dev`. It is a real
 * store, not a stub - words registered here survive restarts.
 *
 * It is deliberately NOT for production. The file lives on the local disk, so
 * it is single-machine only and will not survive a serverless deploy, where
 * the filesystem is read-only and per-invocation. Configure Supabase before
 * deploying; see the README.
 */

interface WordRow {
  id: string;
  headword: string;
  created_at: string;
  updated_at: string;
  // Pre-senses fields. Still read by the migration below, never written.
  meaning_ko?: string;
  test_point?: string | null;
  difficulty_stars?: 1 | 2 | 3;
}
interface SenseRow {
  id: string;
  word_id: string;
  meaning_ko: string;
  test_point: string | null;
  difficulty_stars: 1 | 2 | 3;
  position: number;
}
interface SynonymRow { id: string; word_id: string; sense_id: string; synonym: string; position: number }
interface DerivedRow { id: string; word_id: string; pos: string; derived_word: string; position: number }
interface ExampleRow {
  id: string;
  word_id: string;
  sense_id: string;
  sentence: string;
  matched_surface_form: string;
  match_start: number;
  match_end: number;
  position: number;
}
interface QuestionRow {
  id: string;
  word_id: string;
  sense_id: string;
  question_type: string;
  example_id: string | null;
  created_at: string;
}
interface SessionRow { id: string; started_at: string; completed_at: string | null }
interface AttemptRow {
  id: string;
  session_id: string | null;
  question_id: string;
  word_id: string;
  sense_id: string;
  is_correct: boolean;
  user_answer: string | null;
  answered_at: string;
}
interface TodayLogRow { id: string; word_id: string; shown_on: string; batch?: number }

interface Database {
  words: WordRow[];
  senses: SenseRow[];
  synonyms: SynonymRow[];
  derived_words: DerivedRow[];
  examples: ExampleRow[];
  exam_questions: QuestionRow[];
  exam_sessions: SessionRow[];
  exam_attempts: AttemptRow[];
  today_word_log: TodayLogRow[];
}

export function localDbPath(): string {
  return process.env.LOCAL_DB_PATH
    ? path.resolve(process.env.LOCAL_DB_PATH)
    : path.join(process.cwd(), '.data', 'toefl-vocab.json');
}

/**
 * Bring a file written before senses existed up to the current shape.
 *
 * Words used to carry the meaning, exam note and star rating directly, with
 * synonyms and examples hanging off the word. Each such word becomes a word
 * with exactly one sense, and its children are re-pointed at that sense, so
 * nothing the user typed is lost. Returns true if anything changed.
 */
function migrate(db: Database): boolean {
  let changed = false;

  for (const word of db.words) {
    const hasSense = db.senses.some((s) => s.word_id === word.id);
    if (hasSense) continue;

    const sense: SenseRow = {
      id: randomUUID(),
      word_id: word.id,
      meaning_ko: word.meaning_ko ?? '',
      test_point: word.test_point ?? null,
      difficulty_stars: word.difficulty_stars ?? 3,
      position: 0,
    };
    db.senses.push(sense);

    for (const row of db.synonyms) if (row.word_id === word.id && !row.sense_id) row.sense_id = sense.id;
    for (const row of db.examples) if (row.word_id === word.id && !row.sense_id) row.sense_id = sense.id;
    for (const row of db.exam_questions) if (row.word_id === word.id && !row.sense_id) row.sense_id = sense.id;
    for (const row of db.exam_attempts) if (row.word_id === word.id && !row.sense_id) row.sense_id = sense.id;

    delete word.meaning_ko;
    delete word.test_point;
    delete word.difficulty_stars;
    changed = true;
  }

  return changed;
}

function emptyDb(): Database {
  return {
    words: [],
    senses: [],
    synonyms: [],
    derived_words: [],
    examples: [],
    exam_questions: [],
    exam_sessions: [],
    exam_attempts: [],
    today_word_log: [],
  };
}

async function readDb(): Promise<Database> {
  try {
    const raw = await readFile(localDbPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<Database>;
    // Each key gets its own fresh array. Spreading a shared constant would
    // hand every read the SAME array for any key the file is missing, so a
    // migration writing into it would leak across reads - and the second read
    // would then think the work was already done and skip it.
    const db = emptyDb();
    for (const key of Object.keys(db) as (keyof Database)[]) {
      const rows = parsed[key];
      if (Array.isArray(rows)) (db[key] as unknown[]) = rows;
    }
    // Migrate on read so an older file works immediately; the next write
    // persists the new shape.
    migrate(db);
    return db;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return emptyDb();
    throw err;
  }
}

async function writeDb(db: Database): Promise<void> {
  const file = localDbPath();
  await mkdir(path.dirname(file), { recursive: true });
  // Write to a temp file and rename, so an interrupted write cannot leave
  // behind a half-written file that fails to parse on the next boot.
  const tmp = file + '.' + process.pid + '.tmp';
  await writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await rename(tmp, file);
}

/**
 * Serialises read-modify-write cycles. Next.js can run several route handlers
 * concurrently, and without this two overlapping writes would each start from
 * the same snapshot, so the second would silently discard the first.
 */
let queue: Promise<unknown> = Promise.resolve();
function transaction<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await readDb();
    const result = await fn(db);
    await writeDb(db);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;
const newestFirst = (a: WordRow, b: WordRow) => b.created_at.localeCompare(a.created_at);

function assembleSense(db: Database, row: SenseRow): Sense {
  return {
    id: row.id,
    meaning_ko: row.meaning_ko,
    test_point: row.test_point,
    difficulty_stars: row.difficulty_stars,
    position: row.position,
    synonyms: db.synonyms
      .filter((s) => s.sense_id === row.id)
      .sort(byPosition)
      .map((s) => ({ id: s.id, synonym: s.synonym, position: s.position })),
    examples: db.examples
      .filter((e) => e.sense_id === row.id)
      .sort(byPosition)
      .map((e) => ({
        id: e.id,
        sentence: e.sentence,
        matched_surface_form: e.matched_surface_form,
        match_start: e.match_start,
        match_end: e.match_end,
        position: e.position,
      })),
  };
}

function assemble(db: Database, row: WordRow): Word {
  return {
    id: row.id,
    headword: row.headword,
    created_at: row.created_at,
    updated_at: row.updated_at,
    derived_words: db.derived_words
      .filter((d) => d.word_id === row.id)
      .sort(byPosition)
      .map((d) => ({
        id: d.id,
        pos: d.pos as Word['derived_words'][number]['pos'],
        derived_word: d.derived_word,
        position: d.position,
      })),
    senses: db.senses
      .filter((s) => s.word_id === row.id)
      .sort(byPosition)
      .map((s) => assembleSense(db, s)),
  };
}

/**
 * Write a sense's synonyms, examples and questions, reusing the question rows
 * that are still valid.
 *
 * Questions are reconciled rather than rebuilt because `exam_attempts` hangs
 * off `exam_questions`: dropping and recreating a question would take its
 * answering history with it, and the star rating is derived from that history.
 * Fixing a typo in an example should not quietly reset what the app knows
 * about how well the meaning is known.
 */
function writeSenseChildren(db: Database, senseRow: SenseRow, record: NewSenseRecord, now: string) {
  const wordId = senseRow.word_id;

  // Synonyms and examples carry no history of their own, so replacing them
  // wholesale is safe and much simpler than diffing.
  db.synonyms = db.synonyms.filter((r) => r.sense_id !== senseRow.id);
  record.synonyms.forEach((synonym, position) => {
    db.synonyms.push({ id: randomUUID(), word_id: wordId, sense_id: senseRow.id, synonym, position });
  });

  db.examples = db.examples.filter((r) => r.sense_id !== senseRow.id);
  const exampleIds = record.examples.map((e, position) => {
    const id = randomUUID();
    db.examples.push({ id, word_id: wordId, sense_id: senseRow.id, position, ...e });
    return id;
  });

  const wanted = new Map(record.questions.map((q) => [q.question_type as string, q]));
  const existing = db.exam_questions.filter((q) => q.sense_id === senseRow.id);

  // Drop question types this sense can no longer support (its last synonym
  // was removed, say). Their attempts go too, mirroring the cascade in Postgres.
  for (const q of existing) {
    if (!wanted.has(q.question_type)) {
      db.exam_questions = db.exam_questions.filter((x) => x.id !== q.id);
      db.exam_attempts = db.exam_attempts.filter((a) => a.question_id !== q.id);
    }
  }

  for (const [type, plan] of wanted) {
    const exampleId = plan.example_index === null ? null : exampleIds[plan.example_index] ?? null;
    const kept = db.exam_questions.find((q) => q.sense_id === senseRow.id && q.question_type === type);
    if (kept) {
      // The old example row is gone; point the question at its replacement.
      kept.example_id = exampleId;
    } else {
      db.exam_questions.push({
        id: randomUUID(),
        word_id: wordId,
        sense_id: senseRow.id,
        question_type: type,
        example_id: exampleId,
        created_at: now,
      });
    }
  }
}

export class LocalRepository implements WordRepository {
  readonly backend = 'local' as const;

  async listWords(): Promise<Word[]> {
    const db = await readDb();
    return [...db.words].sort(newestFirst).map((w) => assemble(db, w));
  }

  async getWord(id: string): Promise<Word | null> {
    const db = await readDb();
    const row = db.words.find((w) => w.id === id);
    return row ? assemble(db, row) : null;
  }

  async findWordByHeadword(headword: string): Promise<Word | null> {
    const db = await readDb();
    const target = normaliseHeadword(headword).toLowerCase();
    const row = db.words.find((w) => normaliseHeadword(w.headword).toLowerCase() === target);
    return row ? assemble(db, row) : null;
  }

  async createWord(record: NewWordRecord): Promise<Word> {
    return transaction((db) => {
      const target = normaliseHeadword(record.headword).toLowerCase();
      if (db.words.some((w) => normaliseHeadword(w.headword).toLowerCase() === target)) {
        throw new DuplicateHeadwordError(record.headword);
      }

      const now = new Date().toISOString();
      const word: WordRow = {
        id: randomUUID(),
        headword: record.headword,
        created_at: now,
        updated_at: now,
      };
      db.words.push(word);

      record.derived_words.forEach((d, position) => {
        db.derived_words.push({
          id: randomUUID(),
          word_id: word.id,
          pos: d.pos,
          derived_word: d.derived_word,
          position,
        });
      });

      record.senses.forEach((senseRecord, sensePosition) => {
        const sense: SenseRow = {
          id: randomUUID(),
          word_id: word.id,
          meaning_ko: senseRecord.meaning_ko,
          test_point: senseRecord.test_point,
          // A new sense starts at 3 stars: no exam history, so treat as unfamiliar.
          difficulty_stars: 3,
          position: sensePosition,
        };
        db.senses.push(sense);
        writeSenseChildren(db, sense, senseRecord, now);
      });

      return assemble(db, word);
    });
  }

  async updateWord(id: string, record: NewWordRecord): Promise<Word> {
    return transaction((db) => {
      const word = db.words.find((w) => w.id === id);
      if (!word) throw new Error('수정할 단어를 찾을 수 없습니다.');

      const target = normaliseHeadword(record.headword).toLowerCase();
      // The word keeps its own headword; only a clash with a DIFFERENT word counts.
      if (
        db.words.some(
          (w) => w.id !== id && normaliseHeadword(w.headword).toLowerCase() === target
        )
      ) {
        throw new DuplicateHeadwordError(record.headword);
      }

      const now = new Date().toISOString();
      word.headword = record.headword;
      word.updated_at = now;

      // Derived forms have no history attached, so replace them outright.
      db.derived_words = db.derived_words.filter((r) => r.word_id !== id);
      record.derived_words.forEach((d, position) => {
        db.derived_words.push({
          id: randomUUID(),
          word_id: id,
          pos: d.pos,
          derived_word: d.derived_word,
          position,
        });
      });

      const keptSenseIds = new Set<string>();

      record.senses.forEach((senseRecord, position) => {
        const existing = senseRecord.id
          ? db.senses.find((s) => s.id === senseRecord.id && s.word_id === id)
          : undefined;

        if (existing) {
          // Update in place: difficulty_stars is deliberately untouched, and
          // the row keeps its id so exam_attempts still point at it.
          existing.meaning_ko = senseRecord.meaning_ko;
          existing.test_point = senseRecord.test_point;
          existing.position = position;
          keptSenseIds.add(existing.id);
          writeSenseChildren(db, existing, senseRecord, now);
        } else {
          const sense: SenseRow = {
            id: randomUUID(),
            word_id: id,
            meaning_ko: senseRecord.meaning_ko,
            test_point: senseRecord.test_point,
            difficulty_stars: 3,
            position,
          };
          db.senses.push(sense);
          keptSenseIds.add(sense.id);
          writeSenseChildren(db, sense, senseRecord, now);
        }
      });

      // Senses the user removed, with everything hanging off them.
      const dropped = db.senses.filter((s) => s.word_id === id && !keptSenseIds.has(s.id));
      for (const sense of dropped) {
        const questionIds = new Set(
          db.exam_questions.filter((q) => q.sense_id === sense.id).map((q) => q.id)
        );
        db.senses = db.senses.filter((s) => s.id !== sense.id);
        db.synonyms = db.synonyms.filter((r) => r.sense_id !== sense.id);
        db.examples = db.examples.filter((r) => r.sense_id !== sense.id);
        db.exam_questions = db.exam_questions.filter((q) => q.sense_id !== sense.id);
        db.exam_attempts = db.exam_attempts.filter((a) => !questionIds.has(a.question_id));
      }

      return assemble(db, word);
    });
  }

  async deleteWord(id: string): Promise<void> {
    await transaction((db) => {
      // Mirrors `on delete cascade` in the Postgres schema.
      db.words = db.words.filter((w) => w.id !== id);
      db.senses = db.senses.filter((r) => r.word_id !== id);
      db.synonyms = db.synonyms.filter((r) => r.word_id !== id);
      db.derived_words = db.derived_words.filter((r) => r.word_id !== id);
      db.examples = db.examples.filter((r) => r.word_id !== id);
      db.exam_questions = db.exam_questions.filter((r) => r.word_id !== id);
      db.exam_attempts = db.exam_attempts.filter((r) => r.word_id !== id);
      db.today_word_log = db.today_word_log.filter((r) => r.word_id !== id);
    });
  }

  async listWordsByStars(stars: number[]): Promise<Word[]> {
    const db = await readDb();
    // A word is due for review if ANY of its senses is; the card shows them all.
    const dueWordIds = new Set(
      db.senses.filter((s) => stars.includes(s.difficulty_stars)).map((s) => s.word_id)
    );
    return db.words
      .filter((w) => dueWordIds.has(w.id))
      .sort(newestFirst)
      .map((w) => assemble(db, w));
  }

  async listWordsByIds(ids: string[]): Promise<Word[]> {
    if (ids.length === 0) return [];
    const db = await readDb();
    const wanted = new Set(ids);
    return db.words
      .filter((w) => wanted.has(w.id))
      .sort(newestFirst)
      .map((w) => assemble(db, w));
  }

  async listSensesForExam(): Promise<SenseForExam[]> {
    const db = await readDb();
    const out: SenseForExam[] = [];

    for (const word of db.words) {
      const senses = db.senses.filter((s) => s.word_id === word.id).sort(byPosition);
      const assembled = senses.map((s) => assembleSense(db, s));

      assembled.forEach((sense, index) => {
        const questions = db.exam_questions
          .filter((q) => q.sense_id === sense.id)
          .map((q) => ({
            id: q.id,
            word_id: q.word_id,
            sense_id: q.sense_id,
            question_type: q.question_type as SenseForExam['questions'][number]['question_type'],
            example_id: q.example_id,
          }));
        if (questions.length === 0) return;

        out.push({
          senseId: sense.id,
          wordId: word.id,
          headword: word.headword,
          meaning_ko: sense.meaning_ko,
          difficulty_stars: sense.difficulty_stars,
          senseIndex: index,
          senseTotal: assembled.length,
          otherMeanings: assembled.filter((_, i) => i !== index).map((s) => s.meaning_ko),
          synonyms: sense.synonyms.map((s) => s.synonym),
          siblingSynonyms: assembled
            .filter((_, i) => i !== index)
            .flatMap((s) => s.synonyms.map((x) => x.synonym)),
          examples: sense.examples,
          questions,
        });
      });
    }

    return out;
  }

  async getTodayLog(day: string): Promise<TodayLogEntry[]> {
    const db = await readDb();
    return db.today_word_log
      .filter((r) => r.shown_on === day)
      // Rows written before batches existed count as the first batch.
      .map((r) => ({ wordId: r.word_id, batch: r.batch ?? 1 }));
  }

  async logTodayShown(wordIds: string[], day: string, batch: number): Promise<void> {
    if (wordIds.length === 0) return;
    await transaction((db) => {
      for (const wordId of wordIds) {
        const already = db.today_word_log.some((r) => r.word_id === wordId && r.shown_on === day);
        if (!already) {
          db.today_word_log.push({ id: randomUUID(), word_id: wordId, shown_on: day, batch });
        }
      }
    });
  }

  async createExamSession(): Promise<string> {
    return transaction((db) => {
      const id = randomUUID();
      db.exam_sessions.push({ id, started_at: new Date().toISOString(), completed_at: null });
      return id;
    });
  }

  async completeExamSession(sessionId: string): Promise<void> {
    await transaction((db) => {
      const session = db.exam_sessions.find((s) => s.id === sessionId);
      if (session) session.completed_at = new Date().toISOString();
    });
  }

  async recordAttempts(sessionId: string, attempts: AttemptInput[]): Promise<void> {
    if (attempts.length === 0) return;
    await transaction((db) => {
      const now = Date.now();
      attempts.forEach((a, i) => {
        db.exam_attempts.push({
          id: randomUUID(),
          session_id: sessionId,
          question_id: a.questionId,
          word_id: a.wordId,
          sense_id: a.senseId,
          is_correct: a.isCorrect,
          user_answer: a.userAnswer ?? null,
          // Stagger by index so answers from one submission keep the order they
          // were given in; the star calculation reads the last five in order.
          answered_at: new Date(now + i).toISOString(),
        });
      });
    });
  }

  async getSenseAttemptHistory(senseId: string): Promise<boolean[]> {
    const db = await readDb();
    return db.exam_attempts
      .filter((a) => a.sense_id === senseId)
      .sort((a, b) => a.answered_at.localeCompare(b.answered_at))
      .map((a) => a.is_correct);
  }

  async updateSenseStars(senseId: string, stars: 1 | 2 | 3): Promise<void> {
    await transaction((db) => {
      const sense = db.senses.find((s) => s.id === senseId);
      if (!sense) return;
      sense.difficulty_stars = stars;
      const word = db.words.find((w) => w.id === sense.word_id);
      if (word) word.updated_at = new Date().toISOString();
    });
  }
}
