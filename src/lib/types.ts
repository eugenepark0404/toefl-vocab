export type PartOfSpeech = 'n' | 'v' | 'adj' | 'adv' | 'prep' | 'conj' | 'pron' | 'interj';

export const PART_OF_SPEECH_OPTIONS: { value: PartOfSpeech; label: string }[] = [
  { value: 'n', label: 'n. (명사)' },
  { value: 'v', label: 'v. (동사)' },
  { value: 'adj', label: 'adj. (형용사)' },
  { value: 'adv', label: 'adv. (부사)' },
  { value: 'prep', label: 'prep. (전치사)' },
  { value: 'conj', label: 'conj. (접속사)' },
  { value: 'pron', label: 'pron. (대명사)' },
  { value: 'interj', label: 'interj. (감탄사)' },
];

export interface Synonym {
  id: string;
  synonym: string;
  position: number;
}

export interface DerivedWord {
  id: string;
  pos: PartOfSpeech;
  derived_word: string;
  position: number;
}

export interface Example {
  id: string;
  sentence: string;
  matched_surface_form: string;
  match_start: number;
  match_end: number;
  position: number;
}

/**
 * One meaning of a headword, with the synonyms and examples that belong to
 * that meaning specifically.
 *
 * Senses are the unit the app actually studies. "exploit" as 부당하게 이용하다
 * and "exploit" as 위업 are different things to learn, with different synonyms,
 * so each carries its own star rating and is examined separately. Treating the
 * headword as the unit would let a well-known sense hide an unknown one.
 */
export interface Sense {
  id: string;
  meaning_ko: string;
  test_point: string | null;
  difficulty_stars: 1 | 2 | 3;
  position: number;
  synonyms: Synonym[];
  examples: Example[];
}

export interface Word {
  id: string;
  headword: string;
  created_at: string;
  updated_at: string;
  /** Derived forms belong to the headword, not to one meaning of it. */
  derived_words: DerivedWord[];
  senses: Sense[];
}

/** The rating of the least-known sense: what the word list and filters show. */
export function worstStars(word: Word): 1 | 2 | 3 {
  return word.senses.reduce<1 | 2 | 3>(
    (worst, s) => (s.difficulty_stars > worst ? s.difficulty_stars : worst),
    1
  );
}

/** All meanings of a word, in order, for compact display. */
export function meaningSummary(word: Word): string {
  return word.senses.map((s) => s.meaning_ko).join(' · ');
}

export type QuestionType = 'meaning_write' | 'synonym_choice' | 'blank_fill';

export interface ExamQuestionRow {
  id: string;
  word_id: string;
  sense_id: string;
  question_type: QuestionType;
  example_id: string | null;
}

/** A question as sent to the exam screen, with choices and answer resolved. */
export interface ExamQuestionPayload {
  questionId: string;
  wordId: string;
  senseId: string;
  type: QuestionType;
  headword: string;

  // Which meaning is being asked about. Only meaningful when senseTotal > 1;
  // with a single sense the screen hides all of this so nothing gets easier.
  senseIndex: number;
  senseTotal: number;
  /** The word's other meanings, revealed with the answer so both get learned. */
  otherMeanings?: string[];

  // meaning_write: the student types an answer, reveals, then self-marks.
  correctMeaning?: string;
  /** An example of this sense, shown as context so the right meaning is asked for. */
  contextSentence?: string;

  // synonym_choice: the choices, plus which one is right.
  choices?: string[];
  correctChoiceIndex?: number;
  /** The Korean meaning, shown only to disambiguate a word with several senses. */
  meaningHint?: string;

  // blank_fill: the sentence with a blank, plus the form that belongs in it.
  blankedSentence?: string;
  correctSurfaceForm?: string;
  // The opening letters given away, and how long the answer is. Without these
  // the blank is a guess from context alone.
  hintPrefix?: string;
  answerLength?: number;
}

export interface SenseFormInput {
  meaning_ko: string;
  test_point?: string;
  synonyms: string[];
  examples: string[];
}

export interface WordFormInput {
  headword: string;
  derived_words: { pos: PartOfSpeech; word: string }[];
  senses: SenseFormInput[];
}
