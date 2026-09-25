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

export interface Word {
  id: string;
  headword: string;
  meaning_ko: string;
  test_point: string | null;
  difficulty_stars: 1 | 2 | 3;
  created_at: string;
  updated_at: string;
  synonyms: Synonym[];
  derived_words: DerivedWord[];
  examples: Example[];
}

export type QuestionType = 'meaning_write' | 'synonym_choice' | 'blank_fill';

export interface ExamQuestionRow {
  id: string;
  word_id: string;
  question_type: QuestionType;
  example_id: string | null;
}

/** A question as sent to the exam screen, with choices and answer resolved. */
export interface ExamQuestionPayload {
  questionId: string;
  wordId: string;
  type: QuestionType;
  headword: string;
  // meaning_write: the student types an answer, reveals, then self-marks.
  correctMeaning?: string;
  // synonym_choice: the choices, plus which one is right.
  choices?: string[];
  correctChoiceIndex?: number;
  // blank_fill: the sentence with a blank, plus the form that belongs in it.
  blankedSentence?: string;
  correctSurfaceForm?: string;
}

export interface WordFormInput {
  headword: string;
  meaning_ko: string;
  test_point?: string;
  synonyms: string[];
  derived_words: { pos: PartOfSpeech; word: string }[];
  examples: string[];
}
