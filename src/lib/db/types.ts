import type { Example, ExamQuestionRow, PartOfSpeech, Word } from '@/lib/types';

/**
 * One sense, flattened with everything the exam generator needs about it.
 *
 * The exam draws senses, not words: a word with three meanings has three
 * things to learn, and each is rated separately. Assembling this shape in the
 * repository keeps the route free of backend-specific joins, and guarantees
 * both backends hand the generator identical input.
 */
export interface SenseForExam {
  senseId: string;
  wordId: string;
  headword: string;
  meaning_ko: string;
  difficulty_stars: 1 | 2 | 3;
  /** 0-based position among the word's senses, and how many there are. */
  senseIndex: number;
  senseTotal: number;
  /** The word's other meanings, for context when revealing an answer. */
  otherMeanings: string[];
  synonyms: string[];
  /** Synonyms of this word's OTHER senses. Never usable as wrong answers. */
  siblingSynonyms: string[];
  examples: Example[];
  questions: ExamQuestionRow[];
}

/** One exam question to create alongside a new sense. */
export interface PlannedQuestion {
  question_type: ExamQuestionRow['question_type'];
  /** Index into the sense's own `examples`; only set for `blank_fill`. */
  example_index: number | null;
}

export interface NewSenseRecord {
  /** On an update, the existing sense this replaces. Keeping the row is what
   *  preserves its star rating and its attempt history across an edit. */
  id?: string;
  meaning_ko: string;
  test_point: string | null;
  synonyms: string[];
  examples: {
    sentence: string;
    matched_surface_form: string;
    match_start: number;
    match_end: number;
  }[];
  questions: PlannedQuestion[];
}

/**
 * A word that has been validated and had its example sentences analysed, but
 * has not been persisted yet. Building this record is backend-agnostic (see
 * `src/lib/wordService.ts`), so both storage backends receive identical input.
 */
export interface NewWordRecord {
  headword: string;
  derived_words: { pos: PartOfSpeech; derived_word: string }[];
  senses: NewSenseRecord[];
}

export interface TodayLogEntry {
  wordId: string;
  batch: number;
}

export interface AttemptInput {
  questionId: string;
  wordId: string;
  senseId: string;
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
  /** Case-insensitive, so `Exploit` collides with `exploit`. */
  findWordByHeadword(headword: string): Promise<Word | null>;
  createWord(record: NewWordRecord): Promise<Word>;
  /**
   * Replace a word's content in place.
   *
   * Senses carrying an `id` are updated and keep their rating and history;
   * senses without one are created at 3 stars; senses no longer present are
   * removed. Exam questions are reconciled rather than rebuilt, so answering
   * history is not thrown away by an unrelated edit.
   */
  updateWord(id: string, record: NewWordRecord): Promise<Word>;
  deleteWord(id: string): Promise<void>;

  /** Words with at least one sense at the given star levels, for review. */
  listWordsByStars(stars: number[]): Promise<Word[]>;
  /** Words by id, skipping ids that no longer exist. Used to replay the set
   *  already chosen for today so a refresh shows the same cards. */
  listWordsByIds(ids: string[]): Promise<Word[]>;

  /** Every sense that has at least one exam question attached. */
  listSensesForExam(): Promise<SenseForExam[]>;

  /** `day` is an ISO date (YYYY-MM-DD) in the user's local timezone. */
  getTodayLog(day: string): Promise<TodayLogEntry[]>;
  logTodayShown(wordIds: string[], day: string, batch: number): Promise<void>;

  createExamSession(): Promise<string>;
  completeExamSession(sessionId: string): Promise<void>;
  recordAttempts(sessionId: string, attempts: AttemptInput[]): Promise<void>;
  /** Correct/incorrect flags for one sense, ordered oldest to newest. */
  getSenseAttemptHistory(senseId: string): Promise<boolean[]>;
  updateSenseStars(senseId: string, stars: 1 | 2 | 3): Promise<void>;
}

/** Thrown when a headword already exists, so routes can answer 409 not 500. */
export class DuplicateHeadwordError extends Error {
  constructor(headword: string) {
    super(`"${headword}" is already registered.`);
    this.name = 'DuplicateHeadwordError';
  }
}
