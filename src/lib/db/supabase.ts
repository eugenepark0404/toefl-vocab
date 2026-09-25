import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Word } from '@/lib/types';
import {
  DuplicateHeadwordError,
  type AttemptInput,
  type TodayLogEntry,
  type NewWordRecord,
  type PlannedQuestion,
  type WordRepository,
  type WordWithQuestions,
} from '@/lib/db/types';

/**
 * Supabase (Postgres) storage - the backend for real use.
 *
 * This is what makes the laptop and the phone show the same data: nothing is
 * kept in the browser, so any device hitting the same deployment reads and
 * writes the same rows.
 *
 * The service role key bypasses row level security, so this module must only
 * ever run on the server (route handlers and server components). That is why
 * the variable has no NEXT_PUBLIC_ prefix - adding one would ship a
 * write-capable key to every visitor's browser.
 */

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function createServerSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.'
    );
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

/** Postgres unique-violation, raised here by the unique index on lower(headword). */
const UNIQUE_VIOLATION = '23505';

const WORD_SELECT = '*, synonyms(*), derived_words(*), examples(*)';
const WORD_SELECT_WITH_QUESTIONS = '*, synonyms(*), derived_words(*), examples(*), exam_questions(*)';

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

/**
 * Postgres returns related rows in no guaranteed order, so sort them here.
 * Position order is what the user typed, and the UI depends on it.
 */
function normalise<T extends { synonyms?: any[]; derived_words?: any[]; examples?: any[] }>(row: T): T {
  return {
    ...row,
    synonyms: [...(row.synonyms ?? [])].sort(byPosition),
    derived_words: [...(row.derived_words ?? [])].sort(byPosition),
    examples: [...(row.examples ?? [])].sort(byPosition),
  };
}

function fail(message: string | undefined, fallback: string): never {
  throw new Error(message ?? fallback);
}

export class SupabaseRepository implements WordRepository {
  readonly backend = 'supabase' as const;

  async listWords(): Promise<Word[]> {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('words')
      .select(WORD_SELECT)
      .order('created_at', { ascending: false });
    if (error) fail(error.message, 'Failed to load words.');
    return (data ?? []).map(normalise) as Word[];
  }

  async getWord(id: string): Promise<Word | null> {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.from('words').select(WORD_SELECT).eq('id', id).maybeSingle();
    if (error) fail(error.message, 'Failed to load the word.');
    return data ? (normalise(data) as Word) : null;
  }

  async findWordByHeadword(headword: string): Promise<Word | null> {
    const supabase = createServerSupabaseClient();
    // ilike with no wildcards is an exact, case-insensitive comparison, which
    // matches the unique index on lower(headword).
    const { data, error } = await supabase
      .from('words')
      .select(WORD_SELECT)
      .ilike('headword', headword.trim())
      .maybeSingle();
    if (error) fail(error.message, 'Failed to look up the word.');
    return data ? (normalise(data) as Word) : null;
  }

  async createWord(record: NewWordRecord, questions: PlannedQuestion[]): Promise<Word> {
    const supabase = createServerSupabaseClient();

    const { data: word, error: wordError } = await supabase
      .from('words')
      .insert({
        headword: record.headword,
        meaning_ko: record.meaning_ko,
        test_point: record.test_point,
        // New words start at 3 stars: no exam history yet, so treat as unfamiliar.
        difficulty_stars: 3,
      })
      .select()
      .single();

    if (wordError?.code === UNIQUE_VIOLATION) throw new DuplicateHeadwordError(record.headword);
    if (wordError || !word) fail(wordError?.message, 'Failed to create the word.');

    // Postgres has no multi-statement transaction over the REST API, so if a
    // child insert fails the word row is removed to avoid a half-written word.
    try {
      if (record.synonyms.length > 0) {
        const { error } = await supabase.from('synonyms').insert(
          record.synonyms.map((synonym, position) => ({ word_id: word.id, synonym, position }))
        );
        if (error) fail(error.message, 'Failed to save synonyms.');
      }

      if (record.derived_words.length > 0) {
        const { error } = await supabase.from('derived_words').insert(
          record.derived_words.map((d, position) => ({ word_id: word.id, ...d, position }))
        );
        if (error) fail(error.message, 'Failed to save derived words.');
      }

      let exampleIds: string[] = [];
      if (record.examples.length > 0) {
        const { data: rows, error } = await supabase
          .from('examples')
          .insert(record.examples.map((e, position) => ({ word_id: word.id, position, ...e })))
          .select('id, position');
        if (error) fail(error.message, 'Failed to save examples.');
        exampleIds = [...(rows ?? [])].sort(byPosition).map((r) => r.id as string);
      }

      const { error: questionError } = await supabase.from('exam_questions').insert(
        questions.map((q) => ({
          word_id: word.id,
          question_type: q.question_type,
          example_id: q.example_index === null ? null : exampleIds[q.example_index] ?? null,
        }))
      );
      if (questionError) fail(questionError.message, 'Failed to create exam questions.');
    } catch (err) {
      await supabase.from('words').delete().eq('id', word.id);
      throw err;
    }

    const created = await this.getWord(word.id);
    if (!created) fail(undefined, 'The word was created but could not be read back.');
    return created;
  }

  async deleteWord(id: string): Promise<void> {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from('words').delete().eq('id', id);
    if (error) fail(error.message, 'Failed to delete the word.');
  }

  async listWordsByStars(stars: number[]): Promise<Word[]> {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('words')
      .select(WORD_SELECT)
      .in('difficulty_stars', stars)
      .order('created_at', { ascending: false });
    if (error) fail(error.message, 'Failed to load words.');
    return (data ?? []).map(normalise) as Word[];
  }

  async listWordsByIds(ids: string[]): Promise<Word[]> {
    if (ids.length === 0) return [];
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('words')
      .select(WORD_SELECT)
      .in('id', ids)
      .order('created_at', { ascending: false });
    if (error) fail(error.message, 'Failed to load words.');
    return (data ?? []).map(normalise) as Word[];
  }

  async listWordsWithQuestions(): Promise<WordWithQuestions[]> {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.from('words').select(WORD_SELECT_WITH_QUESTIONS);
    if (error) fail(error.message, 'Failed to load words.');
    return (data ?? [])
      .map(normalise)
      .filter((w: any) => (w.exam_questions ?? []).length > 0) as WordWithQuestions[];
  }

  async getTodayLog(day: string): Promise<TodayLogEntry[]> {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('today_word_log')
      .select('word_id, batch')
      .eq('shown_on', day);
    if (error) fail(error.message, "Failed to load today's log.");
    return (data ?? []).map((r) => ({ wordId: r.word_id as string, batch: (r.batch as number) ?? 1 }));
  }

  async logTodayShown(wordIds: string[], day: string, batch: number): Promise<void> {
    if (wordIds.length === 0) return;
    const supabase = createServerSupabaseClient();
    // (word_id, shown_on) is unique. Two tabs opening the page at once would
    // otherwise collide, so ignore rows that are already there.
    const { error } = await supabase
      .from('today_word_log')
      .upsert(
        wordIds.map((word_id) => ({ word_id, shown_on: day, batch })),
        { onConflict: 'word_id,shown_on', ignoreDuplicates: true }
      );
    if (error) fail(error.message, "Failed to record today's words.");
  }

  async createExamSession(): Promise<string> {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.from('exam_sessions').insert({}).select('id').single();
    if (error || !data) fail(error?.message, 'Failed to start an exam session.');
    return data.id as string;
  }

  async completeExamSession(sessionId: string): Promise<void> {
    const supabase = createServerSupabaseClient();
    await supabase
      .from('exam_sessions')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', sessionId);
  }

  async recordAttempts(sessionId: string, attempts: AttemptInput[]): Promise<void> {
    if (attempts.length === 0) return;
    const supabase = createServerSupabaseClient();
    const now = Date.now();
    const { error } = await supabase.from('exam_attempts').insert(
      attempts.map((a, i) => ({
        session_id: sessionId,
        question_id: a.questionId,
        word_id: a.wordId,
        is_correct: a.isCorrect,
        user_answer: a.userAnswer ?? null,
        // Stagger by index so answers from one submission keep the order they
        // were given in; the star calculation reads the last five in order.
        answered_at: new Date(now + i).toISOString(),
      }))
    );
    if (error) fail(error.message, 'Failed to record answers.');
  }

  async getAttemptHistory(wordId: string): Promise<boolean[]> {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('exam_attempts')
      .select('is_correct, answered_at')
      .eq('word_id', wordId)
      .order('answered_at', { ascending: true });
    if (error) fail(error.message, 'Failed to load exam history.');
    return (data ?? []).map((r) => r.is_correct as boolean);
  }

  async updateWordStars(wordId: string, stars: 1 | 2 | 3): Promise<void> {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from('words').update({ difficulty_stars: stars }).eq('id', wordId);
    if (error) fail(error.message, 'Failed to update the difficulty rating.');
  }
}
