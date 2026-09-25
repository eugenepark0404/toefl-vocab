'use client';

import { useState } from 'react';
import type { ExamQuestionPayload } from '@/lib/types';

interface Props {
  question: ExamQuestionPayload;
  onAnswered: (result: { isCorrect: boolean; userAnswer?: string }) => void;
}

/**
 * Renders one question.
 *
 * - meaning_write: type the meaning, reveal, then mark yourself. A Korean gloss
 *   has too many valid phrasings to grade by string comparison, so the spec
 *   calls for self-checking here.
 * - synonym_choice: multiple choice, graded automatically.
 * - blank_fill: type the missing word. The opening letter and the length are
 *   given, since a bare blank is a guess from context alone. An exact match is
 *   graded automatically; anything else reveals the answer and falls back to
 *   self-marking, because a defensible near-miss should not be forced to wrong.
 */
export default function ExamQuestion({ question, onAnswered }: Props) {
  const [textAnswer, setTextAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  if (question.type === 'synonym_choice') {
    const answered = selectedChoice !== null;
    const isCorrect = selectedChoice === question.correctChoiceIndex;

    return (
      <div className="card">
        <p style={{ marginBottom: 10 }}>
          <strong>{question.headword}</strong>의 동의어를 고르세요.
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          {question.choices?.map((choice, i) => (
            <button
              key={i}
              className="btn btn-secondary"
              style={{
                textAlign: 'left',
                borderColor: answered && i === question.correctChoiceIndex ? '#16a34a' : undefined,
              }}
              disabled={answered}
              onClick={() => setSelectedChoice(i)}
            >
              {choice}
              {answered && i === question.correctChoiceIndex && ' ✅'}
              {answered && i === selectedChoice && !isCorrect && ' ❌'}
            </button>
          ))}
        </div>

        {/* Feedback stays on screen until the user moves on, so a wrong answer
            is actually read instead of flashing past. */}
        {answered && (
          <div style={{ marginTop: 12 }}>
            <p style={{ marginBottom: 8, color: isCorrect ? '#16a34a' : '#dc2626' }}>
              {isCorrect ? '정답입니다.' : '오답입니다.'}
            </p>
            <button
              className="btn"
              onClick={() =>
                onAnswered({ isCorrect, userAnswer: question.choices?.[selectedChoice!] })
              }
            >
              다음
            </button>
          </div>
        )}
      </div>
    );
  }

  if (question.type === 'blank_fill') {
    const correct = question.correctSurfaceForm ?? '';
    const isExactMatch = textAnswer.trim().toLowerCase() === correct.trim().toLowerCase();

    return (
      <div className="card">
        <p style={{ marginBottom: 10 }}>빈칸에 들어갈 단어를 쓰세요.</p>
        <p style={{ marginBottom: 10, lineHeight: 1.8, fontSize: '1.05rem' }}>
          {question.blankedSentence}
        </p>
        {question.hintPrefix && (
          <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: 12 }}>
            {question.hintPrefix}(으)로 시작하는 {question.answerLength}글자
          </p>
        )}
        {!revealed ? (
          <AnswerInput
            value={textAnswer}
            onChange={setTextAnswer}
            onSubmit={() => {
              // An exact match needs no self-check; skip straight on.
              if (isExactMatch) onAnswered({ isCorrect: true, userAnswer: textAnswer });
              else setRevealed(true);
            }}
            placeholder="정답 입력"
          />
        ) : (
          <SelfCheck
            correctAnswer={correct}
            userAnswer={textAnswer}
            onSelect={(isCorrect) => onAnswered({ isCorrect, userAnswer: textAnswer })}
          />
        )}
      </div>
    );
  }

  // meaning_write
  return (
    <div className="card">
      <p style={{ marginBottom: 10 }}>
        <strong>{question.headword}</strong>의 뜻을 한글로 쓰세요.
      </p>
      {!revealed ? (
        <AnswerInput
          value={textAnswer}
          onChange={setTextAnswer}
          onSubmit={() => setRevealed(true)}
          placeholder="뜻 입력"
        />
      ) : (
        <SelfCheck
          correctAnswer={question.correctMeaning ?? ''}
          userAnswer={textAnswer}
          onSelect={(isCorrect) => onAnswered({ isCorrect, userAnswer: textAnswer })}
        />
      )}
    </div>
  );
}

/** Enter submits, so a 45-question sitting never needs the mouse. */
function AnswerInput({
  value,
  onChange,
  onSubmit,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
}) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input
        className="input"
        value={value}
        autoFocus
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
      />
      <button className="btn" onClick={onSubmit}>
        확인
      </button>
    </div>
  );
}

function SelfCheck({
  correctAnswer,
  userAnswer,
  onSelect,
}: {
  correctAnswer: string;
  userAnswer: string;
  onSelect: (isCorrect: boolean) => void;
}) {
  return (
    <div>
      <p style={{ marginBottom: 6, color: '#6b7280' }}>내가 쓴 답: {userAnswer || '(빈칸)'}</p>
      <p style={{ marginBottom: 12 }}>
        정답: <strong>{correctAnswer}</strong>
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" onClick={() => onSelect(true)}>
          맞았어요
        </button>
        <button className="btn btn-secondary" onClick={() => onSelect(false)}>
          틀렸어요
        </button>
      </div>
    </div>
  );
}
