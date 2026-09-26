import { NextResponse } from 'next/server';
import { getDb, type SenseForExam } from '@/lib/db';
import { pickWeightedSenses, pickSynonymDistractors, shuffle } from '@/lib/examGenerator';
import { buildBlankedSentence, buildBlankHint } from '@/lib/wordMatcher';
import type { ExamQuestionPayload, QuestionType } from '@/lib/types';

export const dynamic = 'force-dynamic';

const DAILY_QUESTION_COUNT = 45;
/** Cap on how often one headword may appear in a single sitting. Without it, a
 *  small vocabulary turns a 45-question exam into the same few words on loop.
 *  Counting by headword rather than by sense stops a word with many meanings
 *  from crowding out everything else. */
const MAX_REPEATS_PER_WORD = 3;

export async function POST() {
  try {
    const db = getDb();
    const senses = await db.listSensesForExam();

    if (senses.length === 0) {
      return NextResponse.json(
        { error: '시험을 만들 수 있는 단어가 없습니다. 단어를 먼저 등록해주세요.' },
        { status: 400 }
      );
    }

    const chosen = pickWeightedSenses(senses, DAILY_QUESTION_COUNT, MAX_REPEATS_PER_WORD);

    // Each sense gets a random starting question type, then rotates through the
    // rest on repeat appearances. A random pick every time would ask the same
    // sense the same way twice; always starting at the first type would make
    // meaning_write dominate the sitting.
    const rotation = new Map<string, { start: number; occurrence: number }>();
    const questions: ExamQuestionPayload[] = chosen.map((sense) => {
      let state = rotation.get(sense.senseId);
      if (!state) {
        state = { start: Math.floor(Math.random() * sense.questions.length), occurrence: 0 };
        rotation.set(sense.senseId, state);
      }
      const offset = state.start + state.occurrence;
      state.occurrence++;
      return buildQuestionPayload(sense, senses, offset);
    });

    const sessionId = await db.createExamSession();
    return NextResponse.json({ sessionId, questions, requested: DAILY_QUESTION_COUNT });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? '시험 생성에 실패했습니다.' }, { status: 500 });
  }
}

function buildQuestionPayload(
  sense: SenseForExam,
  allSenses: SenseForExam[],
  offset: number
): ExamQuestionPayload {
  const question = sense.questions[offset % sense.questions.length];
  const type = question.question_type as QuestionType;

  // Carried on every question so the screen can say which meaning is meant.
  const base = {
    questionId: question.id,
    wordId: sense.wordId,
    senseId: sense.senseId,
    headword: sense.headword,
    senseIndex: sense.senseIndex,
    senseTotal: sense.senseTotal,
    otherMeanings: sense.otherMeanings,
  };

  if (type === 'synonym_choice' && sense.synonyms.length > 0) {
    const correct = sense.synonyms[Math.floor(Math.random() * sense.synonyms.length)];
    const distractors = pickSynonymDistractors(sense, allSenses, 3);
    const choices = shuffle([correct, ...distractors]);
    return {
      ...base,
      type: 'synonym_choice',
      choices,
      correctChoiceIndex: choices.indexOf(correct),
      // "account for의 동의어" is unanswerable when the word has three
      // meanings, so name the meaning. With one sense it stays hidden, and the
      // question is no easier than before.
      meaningHint: sense.senseTotal > 1 ? sense.meaning_ko : undefined,
    };
  }

  if (type === 'blank_fill') {
    const example = sense.examples.find((e) => e.id === question.example_id);
    // A question is only created when the span is real (see planQuestions), but
    // guard anyway: blanking a zero-length span would print the answer in full.
    if (example && example.match_end > example.match_start) {
      const hint = buildBlankHint(example.matched_surface_form);
      return {
        ...base,
        type: 'blank_fill',
        blankedSentence: buildBlankedSentence(
          example.sentence,
          example.match_start,
          example.match_end,
          hint.placeholder
        ),
        correctSurfaceForm: example.matched_surface_form,
        hintPrefix: hint.prefix,
        answerLength: hint.length,
      };
    }
  }

  // Fallback: write the meaning. Every sense supports this type.
  const meaningQuestion = sense.questions.find((q) => q.question_type === 'meaning_write') ?? question;
  return {
    ...base,
    questionId: meaningQuestion.id,
    type: 'meaning_write',
    correctMeaning: sense.meaning_ko,
    // Asking "what does account for mean?" has three right answers. An example
    // pins down which one, the way the word is actually met in reading. Without
    // an example the screen falls back to naming the sense by number.
    contextSentence: sense.senseTotal > 1 ? sense.examples[0]?.sentence : undefined,
  };
}
