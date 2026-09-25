import type { PartOfSpeech, QuestionType, Word, ExamQuestionRow } from '@/lib/types';

/** A word plus its auto-generated exam questions. Used by the exam generator. */
export type WordWithQuestions = Word & { exam_questions: ExamQuestionRow[] };

/**
 * A word that has been validated and had its example sentences analysed, but
 * has not been persisted yet. Building this record is backend-agnostic (see
 * `src/lib/wordService.ts`), so both storage backends receive identical input.
 */
export interface NewWordRecord {
  headword: string;
  meaning_ko: string;
  test_point: string | null;
  synonyms: string[];
  derived_words: { pos: PartOfSpeech; derived_word: string }[];
  examples: {
    sentence: string;
    matched_surface_form: string;
    match_start: number;
    match_end: number;
  }[];
}

/** One exam question to create alongside a new word. */
export interface PlannedQuestion {
  question_type: QuestionType;
  /** Index into `NewWordRecord.examples`; only set for `blank_fill`. */
  example_index: number | null;
}

export interface TodayLogEntry {
  wordId: string;
  batch: number;
}

export interface AttemptInput {
  questionId: string;
  wordId: string;
  isCorrect: boolean;
  userAnswer?: string;
}

/**
 * Everything the app needs from storage.
 *
 * Two implementations exist and are chosen at runtime by `getDb()`:
 *   - `local.ts`    JSON file on disk. No setup, no account. Default.
 *   - `supabase.ts` Postgres via Supabase. Used when env vars are present.
 *
 * Keeping the surface this narrow is what makes the two interchangeable:
 * route handlers never see a Supabase client or a file path.
 */
export interface WordRepository {
  /** Which backend is active, for the storage badge on the home page. */
  readonly backend: 'local' | 'supabase';

  listWords(): Promise<Word[]>;
  getWord(id: string): Promise<Word | null>;
  /** Case-insensitive, so `Ubiquitous` collides with `ubiquitous`. */
  findWordByHeadword(headword: string): Promise<Word | null>;
  createWord(record: NewWordRecord, questions: PlannedQuestion[]): Promise<Word>;
  deleteWord(id: string): Promise<void>;

  /** Words at the given star levels, for "Today's words". */
  listWordsByStars(stars: number[]): Promise<Word[]>;
  /** Words by id, skipping ids that no longer exist. Used to replay the set
   *  already chosen for today so a refresh shows the same cards. */
  listWordsByIds(ids: string[]): Promise<Word[]>;
  /** Only words that have at least one exam question attached. */
  listWordsWithQuestions(): Promise<WordWithQuestions[]>;

  /** What has been shown today, with the batch each word belongs to.
   *  `day` is an ISO date (YYYY-MM-DD) in the user's local timezone. */
  getTodayLog(day: string): Promise<TodayLogEntry[]>;
  logTodayShown(wordIds: string[], day: string, batch: number): Promise<void>;

  createExamSession(): Promise<string>;
  completeExamSession(sessionId: string): Promise<void>;
  recordAttempts(sessionId: string, attempts: AttemptInput[]): Promise<void>;
  /** Correct/incorrect flags for one word, ordered oldest to newest. */
  getAttemptHistory(wordId: string): Promise<boolean[]>;
  updateWordStars(wordId: string, stars: 1 | 2 | 3): Promise<void>;
}

/** Thrown when a headword already exists, so routes can answer 409 not 500. */
export class DuplicateHeadwordError extends Error {
  constructor(headword: string) {
    super(`"${headword}" is already registered.`);
    this.name = 'DuplicateHeadwordError';
  }
}
