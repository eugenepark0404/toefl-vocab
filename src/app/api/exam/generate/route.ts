import { NextResponse } from 'next/server';
import { getDb, type WordWithQuestions } from '@/lib/db';
import { pickWeightedWords, pickSynonymDistractors, shuffle } from '@/lib/examGenerator';
import { buildBlankedSentence } from '@/lib/wordMatcher';
import type { ExamQuestionPayload, QuestionType } from '@/lib/types';

export const dynamic = 'force-dynamic';

const DAILY_QUESTION_COUNT = 45;
/** Cap on how often one word may appear in a single sitting. Without it, a
 *  small vocabulary turns a 45-question exam into the same few words on loop.
 *  Below 15 words the exam is simply shorter than 45 questions. */
const MAX_REPEATS_PER_WORD = 3;

export async function POST() {
  try {
    const db = getDb();
    const words = await db.listWordsWithQuestions();

    if (words.length === 0) {
      return NextResponse.json(
        { error: '시험을 만들 수 있는 단어가 없습니다. 단어를 먼저 등록해주세요.' },
        { status: 400 }
      );
    }

    const chosen = pickWeightedWords(words, DAILY_QUESTION_COUNT, MAX_REPEATS_PER_WORD);

    // Each word gets a random starting question type, then rotates through the
    // rest on repeat appearances. A random pick every time would ask the same
    // word the same way twice; always starting at the first type would make
    // meaning_write dominate the sitting.
    const rotation = new Map<string, { start: number; occurrence: number }>();
    const questions: ExamQuestionPayload[] = chosen.map((word) => {
      let state = rotation.get(word.id);
      if (!state) {
        state = { start: Math.floor(Math.random() * word.exam_questions.length), occurrence: 0 };
        rotation.set(word.id, state);
      }
      const offset = state.start + state.occurrence;
      state.occurrence++;
      return buildQuestionPayload(word, words, offset);
    });

    const sessionId = await db.createExamSession();
    return NextResponse.json({ sessionId, questions, requested: DAILY_QUESTION_COUNT });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? '시험 생성에 실패했습니다.' }, { status: 500 });
  }
}

function buildQuestionPayload(
  word: WordWithQuestions,
  allWords: WordWithQuestions[],
  offset: number
): ExamQuestionPayload {
  const available = word.exam_questions;
  const question = available[offset % available.length];
  const type = question.question_type as QuestionType;

  if (type === 'synonym_choice' && word.synonyms.length > 0) {
    const correct = word.synonyms[Math.floor(Math.random() * word.synonyms.length)].synonym;
    const distractors = pickSynonymDistractors(word, allWords, 3);
    const choices = shuffle([correct, ...distractors]);
    return {
      questionId: question.id,
      wordId: word.id,
      type: 'synonym_choice',
      headword: word.headword,
      choices,
      correctChoiceIndex: choices.indexOf(correct),
    };
  }

  if (type === 'blank_fill') {
    const example = word.examples.find((e) => e.id === question.example_id);
    // A question is only created when the span is real (see planQuestions), but
    // guard anyway: blanking a zero-length span would print the answer in full.
    if (example && example.match_end > example.match_start) {
      return {
        questionId: question.id,
        wordId: word.id,
        type: 'blank_fill',
        headword: word.headword,
        blankedSentence: buildBlankedSentence(example.sentence, example.match_start, example.match_end),
        correctSurfaceForm: example.matched_surface_form,
      };
    }
  }

  // Fallback: write the meaning. Every word supports this type.
  const meaningQuestion = available.find((q) => q.question_type === 'meaning_write') ?? question;
  return {
    questionId: meaningQuestion.id,
    wordId: word.id,
    type: 'meaning_write',
    headword: word.headword,
    correctMeaning: word.meaning_ko,
  };
}
