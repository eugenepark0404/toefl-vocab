import type { WordFormInput } from '@/lib/types';

/**
 * Starter vocabulary, so a fresh install has something to study before you
 * have typed anything in. Loaded on demand from the empty word list, never
 * automatically - your own words should not arrive mixed in with these.
 *
 * Every example sentence here uses a form the matcher can find, so each sense
 * gets all three question types. A few entries carry several meanings on
 * purpose: they are what the per-sense rating and the disambiguated questions
 * exist for, and they show what the registration form is asking for.
 */
export const SEED_WORDS: WordFormInput[] = [
  {
    headword: 'account for',
    derived_words: [],
    senses: [
      {
        meaning_ko: '설명하다',
        synonyms: ['explain', 'justify', 'clarify'],
        examples: ['The theory accounts for the observed differences in rainfall.'],
        test_point: '"이유를 대다"에 가까운 뜻. 뒤에 for가 반드시 따라옴',
      },
      {
        meaning_ko: '(비율을) 차지하다',
        synonyms: ['constitute', 'comprise', 'make up'],
        examples: ["Renewable sources account for nearly a third of the nation's electricity."],
        test_point: '통계·비율을 말하는 문장에서 이 뜻으로 출제됨',
      },
      {
        meaning_ko: '원인이 되다',
        synonyms: ['cause', 'produce', 'bring about'],
        examples: ['Genetic factors account for much of the variation in height.'],
      },
    ],
  },
  {
    headword: 'advocate',
    derived_words: [{ pos: 'n', word: 'advocacy' }],
    senses: [
      {
        meaning_ko: '옹호하다, 지지하다',
        synonyms: ['support', 'endorse', 'champion'],
        examples: ['Many scientists advocate stricter limits on carbon emissions.'],
        test_point: '동사일 때는 뒤에 목적어가 바로 옴 (advocate for X는 구어)',
      },
      {
        meaning_ko: '옹호자, 지지자',
        synonyms: ['supporter', 'proponent', 'backer'],
        examples: ['She became a leading advocate of education reform.'],
      },
    ],
  },
  {
    headword: 'deliberate',
    derived_words: [{ pos: 'adv', word: 'deliberately' }],
    senses: [
      {
        meaning_ko: '의도적인, 고의의',
        synonyms: ['intentional', 'calculated', 'premeditated'],
        examples: ['The omission was deliberate, not an oversight.'],
        test_point: '형용사와 동사의 발음이 다름',
      },
      {
        meaning_ko: '숙고하다, 논의하다',
        synonyms: ['ponder', 'contemplate', 'weigh'],
        examples: ['The jury deliberated for three days before reaching a verdict.'],
      },
    ],
  },
  {
    headword: 'ubiquitous',
    derived_words: [{ pos: 'n', word: 'ubiquity' }],
    senses: [
      {
        meaning_ko: '어디에나 있는, 편재하는',
        synonyms: ['omnipresent', 'pervasive', 'universal'],
        examples: ['Smartphones have become ubiquitous in modern life.'],
        test_point: '"흔한(common)"보다 강한 뉘앙스로, 동시에 여러 곳에 존재한다는 의미',
      },
    ],
  },
  {
    headword: 'mitigate',
    derived_words: [{ pos: 'n', word: 'mitigation' }],
    senses: [
      {
        meaning_ko: '완화하다, 경감하다',
        synonyms: ['alleviate', 'lessen', 'ease'],
        examples: ['The new policy aims to mitigate the effects of air pollution.'],
        test_point: '나쁜 것의 정도를 줄일 때 사용. 문제 자체를 없애는 solve와 구분',
      },
    ],
  },
  {
    headword: 'ambiguous',
    derived_words: [{ pos: 'n', word: 'ambiguity' }],
    senses: [
      {
        meaning_ko: '모호한, 두 가지 이상으로 해석되는',
        synonyms: ['vague', 'unclear', 'equivocal'],
        examples: ['The instructions were so ambiguous that nobody knew what to do.'],
        test_point: '뜻이 여러 개라 헷갈리는 것. 단순히 정보가 부족한 obscure와 구분',
      },
    ],
  },
  {
    headword: 'deteriorate',
    derived_words: [{ pos: 'n', word: 'deterioration' }],
    senses: [
      {
        meaning_ko: '악화되다, 나빠지다',
        synonyms: ['worsen', 'decline', 'degenerate'],
        examples: ['Her health began to deteriorate after the surgery.'],
        test_point: '주로 자동사로 쓰여 상태가 스스로 나빠지는 것을 나타냄',
      },
    ],
  },
  {
    headword: 'plausible',
    derived_words: [{ pos: 'n', word: 'plausibility' }],
    senses: [
      {
        meaning_ko: '그럴듯한, 타당해 보이는',
        synonyms: ['credible', 'believable', 'reasonable'],
        examples: ['He offered a plausible explanation for his absence.'],
        test_point: '실제로 사실인지와는 별개로 "말이 되어 보인다"는 뜻',
      },
    ],
  },
  {
    headword: 'arbitrary',
    derived_words: [{ pos: 'adv', word: 'arbitrarily' }],
    senses: [
      {
        meaning_ko: '임의적인, 자의적인',
        synonyms: ['random', 'capricious', 'unreasoned'],
        examples: ['The committee decision seemed completely arbitrary.'],
        test_point: '기준이나 근거 없이 정해졌다는 부정적 뉘앙스',
      },
    ],
  },
  {
    headword: 'conspicuous',
    derived_words: [{ pos: 'adv', word: 'conspicuously' }],
    senses: [
      {
        meaning_ko: '눈에 잘 띄는, 뚜렷한',
        synonyms: ['noticeable', 'prominent', 'striking'],
        examples: ['The red building was conspicuous among the gray offices.'],
        test_point: '반의어 inconspicuous(눈에 띄지 않는)와 함께 출제되는 경우가 많음',
      },
    ],
  },
  {
    headword: 'diminish',
    derived_words: [{ pos: 'n', word: 'diminution' }],
    senses: [
      {
        meaning_ko: '줄어들다, 감소시키다',
        synonyms: ['decrease', 'reduce', 'dwindle'],
        examples: ['Interest in the project diminished over time.'],
        test_point: '자동사와 타동사 모두 가능',
      },
    ],
  },
  {
    headword: 'coherent',
    derived_words: [{ pos: 'n', word: 'coherence' }],
    senses: [
      {
        meaning_ko: '일관성 있는, 논리 정연한',
        synonyms: ['logical', 'consistent', 'unified'],
        examples: ['She presented a coherent argument for the reform.'],
        test_point: '부분들이 논리적으로 맞물려 있다는 의미',
      },
    ],
  },
  {
    headword: 'exacerbate',
    derived_words: [{ pos: 'n', word: 'exacerbation' }],
    senses: [
      {
        meaning_ko: '악화시키다, 더 심하게 만들다',
        synonyms: ['aggravate', 'intensify', 'worsen'],
        examples: ['Cutting the budget would only exacerbate the problem.'],
        test_point: '타동사. 스스로 나빠지는 deteriorate와 방향이 반대',
      },
    ],
  },
  {
    headword: 'prevalent',
    derived_words: [{ pos: 'n', word: 'prevalence' }],
    senses: [
      {
        meaning_ko: '널리 퍼진, 만연한',
        synonyms: ['widespread', 'common', 'rife'],
        examples: ['This species is prevalent along the eastern coast.'],
        test_point: '특정 지역이나 집단에서 흔하다는 뜻',
      },
    ],
  },
  {
    headword: 'scrutinize',
    derived_words: [{ pos: 'n', word: 'scrutiny' }],
    senses: [
      {
        meaning_ko: '면밀히 조사하다, 자세히 살피다',
        synonyms: ['examine', 'inspect', 'analyze'],
        examples: ['Auditors scrutinize every transaction in the report.'],
        test_point: '그냥 보는 것이 아니라 아주 꼼꼼히 본다는 강조',
      },
    ],
  },
  {
    headword: 'tentative',
    derived_words: [{ pos: 'adv', word: 'tentatively' }],
    senses: [
      {
        meaning_ko: '잠정적인, 확정되지 않은',
        synonyms: ['provisional', 'preliminary', 'unconfirmed'],
        examples: ['They reached a tentative agreement on the schedule.'],
      },
      {
        meaning_ko: '머뭇거리는, 조심스러운',
        synonyms: ['hesitant', 'cautious', 'uncertain'],
        examples: ['He took a few tentative steps onto the ice.'],
      },
    ],
  },
  {
    headword: 'viable',
    derived_words: [{ pos: 'n', word: 'viability' }],
    senses: [
      {
        meaning_ko: '실행 가능한',
        synonyms: ['feasible', 'workable', 'practicable'],
        examples: ['Solar power is now a viable alternative to coal.'],
      },
      {
        meaning_ko: '생존 가능한',
        synonyms: ['surviving', 'living'],
        examples: ['The seeds remain viable for several years.'],
        test_point: '생물학 지문에서는 이 뜻으로 출제됨',
      },
    ],
  },
  {
    headword: 'resilient',
    derived_words: [{ pos: 'n', word: 'resilience' }],
    senses: [
      {
        meaning_ko: '회복력 있는, 탄력 있는',
        synonyms: ['tough', 'adaptable', 'hardy'],
        examples: ['Coral reefs are less resilient than they once were.'],
        test_point: '충격을 받은 뒤 원래 상태로 돌아오는 능력',
      },
    ],
  },
  {
    headword: 'abundant',
    derived_words: [{ pos: 'n', word: 'abundance' }],
    senses: [
      {
        meaning_ko: '풍부한, 많은',
        synonyms: ['plentiful', 'ample', 'copious'],
        examples: ['Fossils are abundant in this region.'],
        test_point: '반의어 scarce(부족한)와 짝으로 자주 출제',
      },
    ],
  },
  {
    headword: 'intricate',
    derived_words: [{ pos: 'n', word: 'intricacy' }],
    senses: [
      {
        meaning_ko: '복잡한, 정교한',
        synonyms: ['complex', 'elaborate', 'convoluted'],
        examples: ['The clock contains an intricate system of gears.'],
        test_point: '부정적인 "복잡함"보다 정교하다는 뉘앙스가 강함',
      },
    ],
  },
  {
    headword: 'obsolete',
    derived_words: [{ pos: 'n', word: 'obsolescence' }],
    senses: [
      {
        meaning_ko: '구식의, 더 이상 쓰이지 않는',
        synonyms: ['outdated', 'antiquated', 'outmoded'],
        examples: ['Typewriters became obsolete once computers arrived.'],
        test_point: '기술·제도가 새것에 밀려 쓸모없어진 상태',
      },
    ],
  },
];
