import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Word } from '@/lib/types';
import {
  DuplicateHeadwordError,
  type AttemptInput,
  type NewWordRecord,
  type PlannedQuestion,
  type WordRepository,
  type WordWithQuestions,
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
  meaning_ko: string;
  test_point: string | null;
  difficulty_stars: 1 | 2 | 3;
  created_at: string;
  updated_at: string;
}
interface SynonymRow { id: string; word_id: string; synonym: string; position: number }
interface DerivedRow { id: string; word_id: string; pos: string; derived_word: string; position: number }
interface ExampleRow {
  id: string;
  word_id: string;
  sentence: string;
  matched_surface_form: string;
  match_start: number;
  match_end: number;
  position: number;
}
interface QuestionRow {
  id: string;
  word_id: string;
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
  is_correct: boolean;
  user_answer: string | null;
  answered_at: string;
}
interface TodayLogRow { id: string; word_id: string; shown_on: string }

interface Database {
  words: WordRow[];
  synonyms: SynonymRow[];
  derived_words: DerivedRow[];
  examples: ExampleRow[];
  exam_questions: QuestionRow[];
  exam_sessions: SessionRow[];
  exam_attempts: AttemptRow[];
  today_word_log: TodayLogRow[];
}

const EMPTY_DB: Database = {
  words: [],
  synonyms: [],
  derived_words: [],
  examples: [],
  exam_questions: [],
  exam_sessions: [],
  exam_attempts: [],
  today_word_log: [],
};

export function localDbPath(): string {
  return process.env.LOCAL_DB_PATH
    ? path.resolve(process.env.LOCAL_DB_PATH)
    : path.join(process.cwd(), '.data', 'toefl-vocab.json');
}

async function readDb(): Promise<Database> {
  try {
    const raw = await readFile(localDbPath(), 'utf8');
    return { ...EMPTY_DB, ...(JSON.parse(raw) as Partial<Database>) };
  } catch (err: any) {
    if (err?.code === 'ENOENT') return JSON.parse(JSON.stringify(EMPTY_DB)) as Database;
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

function assemble(db: Database, row: WordRow): Word {
  return {
    id: row.id,
    headword: row.headword,
    meaning_ko: row.meaning_ko,
    test_point: row.test_point,
    difficulty_stars: row.difficulty_stars,
    created_at: row.created_at,
    updated_at: row.updated_at,
    synonyms: db.synonyms
      .filter((s) => s.word_id === row.id)
      .sort(byPosition)
      .map((s) => ({ id: s.id, synonym: s.synonym, position: s.position })),
    derived_words: db.derived_words
      .filter((d) => d.word_id === row.id)
      .sort(byPosition)
      .map((d) => ({
        id: d.id,
        pos: d.pos as Word['derived_words'][number]['pos'],
        derived_word: d.derived_word,
        position: d.position,
      })),
    examples: db.examples
      .filter((e) => e.word_id === row.id)
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
    const target = headword.trim().toLowerCase();
    const row = db.words.find((w) => w.headword.toLowerCase() === target);
    return row ? assemble(db, row) : null;
  }

  async createWord(record: NewWordRecord, questions: PlannedQuestion[]): Promise<Word> {
    return transaction((db) => {
      const target = record.headword.toLowerCase();
      if (db.words.some((w) => w.headword.toLowerCase() === target)) {
        throw new DuplicateHeadwordError(record.headword);
      }

      const now = new Date().toISOString();
      const word: WordRow = {
        id: randomUUID(),
        headword: record.headword,
        meaning_ko: record.meaning_ko,
        test_point: record.test_point,
        // New words start at 3 stars: no exam history yet, so treat as unfamiliar.
        difficulty_stars: 3,
        created_at: now,
        updated_at: now,
      };
      db.words.push(word);

      record.synonyms.forEach((synonym, position) => {
        db.synonyms.push({ id: randomUUID(), word_id: word.id, synonym, position });
      });
      record.derived_words.forEach((d, position) => {
        db.derived_words.push({
          id: randomUUID(),
          word_id: word.id,
          pos: d.pos,
          derived_word: d.derived_word,
          position,
        });
      });

      const exampleIds = record.examples.map((e, position) => {
        const id = randomUUID();
        db.examples.push({ id, word_id: word.id, position, ...e });
        return id;
      });

      questions.forEach((q) => {
        db.exam_questions.push({
          id: randomUUID(),
          word_id: word.id,
          question_type: q.question_type,
          example_id: q.example_index === null ? null : exampleIds[q.example_index] ?? null,
          created_at: now,
        });
      });

      return assemble(db, word);
    });
  }

  async deleteWord(id: string): Promise<void> {
    await transaction((db) => {
      // Mirrors `on delete cascade` in the Postgres schema.
      db.words = db.words.filter((w) => w.id !== id);
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
    return db.words
      .filter((w) => stars.includes(w.difficulty_stars))
      .sort(newestFirst)
      .map((w) => assemble(db, w));
  }

  async listWordsWithQuestions(): Promise<WordWithQuestions[]> {
    const db = await readDb();
    return db.words
      .map((row) => ({
        ...assemble(db, row),
        exam_questions: db.exam_questions
          .filter((q) => q.word_id === row.id)
          .map((q) => ({
            id: q.id,
            word_id: q.word_id,
            question_type: q.question_type as WordWithQuestions['exam_questions'][number]['question_type'],
            example_id: q.example_id,
          })),
      }))
      .filter((w) => w.exam_questions.length > 0);
  }

  async getTodayShownWordIds(day: string): Promise<string[]> {
    const db = await readDb();
    return db.today_word_log.filter((r) => r.shown_on === day).map((r) => r.word_id);
  }

  async logTodayShown(wordIds: string[], day: string): Promise<void> {
    if (wordIds.length === 0) return;
    await transaction((db) => {
      for (const wordId of wordIds) {
        const already = db.today_word_log.some((r) => r.word_id === wordId && r.shown_on === day);
        if (!already) db.today_word_log.push({ id: randomUUID(), word_id: wordId, shown_on: day });
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
          is_correct: a.isCorrect,
          user_answer: a.userAnswer ?? null,
          // Stagger by index so answers from one submission keep the order they
          // were given in; the star calculation reads the last five in order.
          answered_at: new Date(now + i).toISOString(),
        });
      });
    });
  }

  async getAttemptHistory(wordId: string): Promise<boolean[]> {
    const db = await readDb();
    return db.exam_attempts
      .filter((a) => a.word_id === wordId)
      .sort((a, b) => a.answered_at.localeCompare(b.answered_at))
      .map((a) => a.is_correct);
  }

  async updateWordStars(wordId: string, stars: 1 | 2 | 3): Promise<void> {
    await transaction((db) => {
      const word = db.words.find((w) => w.id === wordId);
      if (word) {
        word.difficulty_stars = stars;
        word.updated_at = new Date().toISOString();
      }
    });
  }
}
