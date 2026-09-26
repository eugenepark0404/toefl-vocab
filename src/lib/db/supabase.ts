import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Sense, Word } from '@/lib/types';
import {
  DuplicateHeadwordError,
  type AttemptInput,
  type NewWordRecord,
  type SenseForExam,
  type TodayLogEntry,
  type WordRepository,
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

const WORD_SELECT = '*, derived_words(*), senses(*, synonyms(*), examples(*))';

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

/**
 * Postgres returns related rows in no guaranteed order, so sort them here.
 * Position order is what the user typed, and the UI depends on it.
 */
function normalise(row: any): Word {
  return {
    id: row.id,
    headword: row.headword,
    created_at: row.created_at,
    updated_at: row.updated_at,
    derived_words: [...(row.derived_words ?? [])].sort(byPosition),
    senses: [...(row.senses ?? [])].sort(byPosition).map(
      (s: any): Sense => ({
        id: s.id,
        meaning_ko: s.meaning_ko,
        test_point: s.test_point,
        difficulty_stars: s.difficulty_stars,
        position: s.position,
        synonyms: [...(s.synonyms ?? [])].sort(byPosition),
        examples: [...(s.examples ?? [])].sort(byPosition),
      })
    ),
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
    return (data ?? []).map(normalise);
  }

  async getWord(id: string): Promise<Word | null> {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.from('words').select(WORD_SELECT).eq('id', id).maybeSingle();
    if (error) fail(error.message, 'Failed to load the word.');
    return data ? normalise(data) : null;
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
    return data ? normalise(data) : null;
  }

  async createWord(record: NewWordRecord): Promise<Word> {
    const supabase = createServerSupabaseClient();

    const { data: word, error: wordError } = await supabase
      .from('words')
      .insert({ headword: record.headword })
      .select()
      .single();

    if (wordError?.code === UNIQUE_VIOLATION) throw new DuplicateHeadwordError(record.headword);
    if (wordError || !word) fail(wordError?.message, 'Failed to create the word.');

    // Postgres has no multi-statement transaction over the REST API, so if a
    // child insert fails the word row is removed to avoid a half-written word.
    try {
      if (record.derived_words.length > 0) {
        const { error } = await supabase.from('derived_words').insert(
          record.derived_words.map((d, position) => ({ word_id: word.id, ...d, position }))
        );
        if (error) fail(error.message, 'Failed to save derived words.');
      }

      for (const [sensePosition, senseRecord] of record.senses.entries()) {
        const { data: sense, error: senseError } = await supabase
          .from('senses')
          .insert({
            word_id: word.id,
            meaning_ko: senseRecord.meaning_ko,
            test_point: senseRecord.test_point,
            // A new sense starts at 3 stars: no exam history yet.
            difficulty_stars: 3,
            position: sensePosition,
          })
          .select()
          .single();
        if (senseError || !sense) fail(senseError?.message, 'Failed to save a meaning.');

        if (senseRecord.synonyms.length > 0) {
          const { error } = await supabase.from('synonyms').insert(
            senseRecord.synonyms.map((synonym, position) => ({
              word_id: word.id,
              sense_id: sense.id,
              synonym,
              position,
            }))
          );
          if (error) fail(error.message, 'Failed to save synonyms.');
        }

        let exampleIds: string[] = [];
        if (senseRecord.examples.length > 0) {
          const { data: rows, error } = await supabase
            .from('examples')
            .insert(
              senseRecord.examples.map((e, position) => ({
                word_id: word.id,
                sense_id: sense.id,
                position,
                ...e,
              }))
            )
            .select('id, position');
          if (error) fail(error.message, 'Failed to save examples.');
          exampleIds = [...(rows ?? [])].sort(byPosition).map((r) => r.id as string);
        }

        const { error: questionError } = await supabase.from('exam_questions').insert(
          senseRecord.questions.map((q) => ({
            word_id: word.id,
            sense_id: sense.id,
            question_type: q.question_type,
            example_id: q.example_index === null ? null : exampleIds[q.example_index] ?? null,
          }))
        );
        if (questionError) fail(questionError.message, 'Failed to create exam questions.');
      }
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
    // A word is due for review if ANY of its senses is; the card shows them all.
    const { data: due, error: dueError } = await supabase
      .from('senses')
      .select('word_id')
      .in('difficulty_stars', stars);
    if (dueError) fail(dueError.message, 'Failed to load review candidates.');

    const ids = Array.from(new Set((due ?? []).map((r) => r.word_id as string)));
    return this.listWordsByIds(ids);
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
    return (data ?? []).map(normalise);
  }

  async listSensesForExam(): Promise<SenseForExam[]> {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('words')
      .select('*, derived_words(*), senses(*, synonyms(*), examples(*), exam_questions(*))');
    if (error) fail(error.message, 'Failed to load words.');

    const out: SenseForExam[] = [];
    for (const row of data ?? []) {
      const word = normalise(row);
      const questionsBySense = new Map<string, any[]>();
      for (const s of (row as any).senses ?? []) {
        questionsBySense.set(s.id, s.exam_questions ?? []);
      }

      word.senses.forEach((sense, index) => {
        const questions = (questionsBySense.get(sense.id) ?? []).map((q: any) => ({
          id: q.id,
          word_id: q.word_id,
          sense_id: q.sense_id,
          question_type: q.question_type,
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
          senseTotal: word.senses.length,
          otherMeanings: word.senses.filter((_, i) => i !== index).map((s) => s.meaning_ko),
          synonyms: sense.synonyms.map((s) => s.synonym),
          siblingSynonyms: word.senses
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
        sense_id: a.senseId,
        is_correct: a.isCorrect,
        user_answer: a.userAnswer ?? null,
        // Stagger by index so answers from one submission keep the order they
        // were given in; the star calculation reads the last five in order.
        answered_at: new Date(now + i).toISOString(),
      }))
    );
    if (error) fail(error.message, 'Failed to record answers.');
  }

  async getSenseAttemptHistory(senseId: string): Promise<boolean[]> {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('exam_attempts')
      .select('is_correct, answered_at')
      .eq('sense_id', senseId)
      .order('answered_at', { ascending: true });
    if (error) fail(error.message, 'Failed to load exam history.');
    return (data ?? []).map((r) => r.is_correct as boolean);
  }

  async updateSenseStars(senseId: string, stars: 1 | 2 | 3): Promise<void> {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from('senses').update({ difficulty_stars: stars }).eq('id', senseId);
    if (error) fail(error.message, 'Failed to update the difficulty rating.');
  }
}
