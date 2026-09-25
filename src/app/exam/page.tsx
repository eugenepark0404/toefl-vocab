'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExamQuestionPayload } from '@/lib/types';
import ExamQuestion from '@/components/ExamQuestion';

interface AnswerRecord {
  questionId: string;
  wordId: string;
  isCorrect: boolean;
  userAnswer?: string;
}

export default function ExamPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ExamQuestionPayload[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Guards against a double submit if the effect below re-runs.
  const submittedSessions = useRef<Set<string>>(new Set());

  const startExam = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/exam/generate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '시험 생성에 실패했습니다.');
      setSessionId(data.sessionId);
      setQuestions(data.questions);
      setIndex(0);
      setAnswers([]);
      setSubmitted(false);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const finished = questions.length > 0 && answers.length === questions.length;

  // Submit once the last question is answered. This has to be an effect: the
  // previous version called submit during render, which updates state mid-render
  // and can fire twice.
  useEffect(() => {
    if (!sessionId || !finished || submitted || submittedSessions.current.has(sessionId)) return;
    submittedSessions.current.add(sessionId);

    let cancelled = false;
    setSubmitting(true);
    (async () => {
      try {
        const res = await fetch('/api/exam/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, answers }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? '채점에 실패했습니다.');
        if (!cancelled) setSubmitted(true);
      } catch (err: any) {
        if (!cancelled) {
          // The answers are still on screen, so allow a retry rather than
          // losing the whole sitting.
          submittedSessions.current.delete(sessionId);
          setErrorMsg(err.message);
        }
      } finally {
        if (!cancelled) setSubmitting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, finished, submitted, answers]);

  function handleAnswered(result: { isCorrect: boolean; userAnswer?: string }) {
    const q = questions[index];
    setAnswers((prev) => [
      ...prev,
      {
        questionId: q.questionId,
        wordId: q.wordId,
        isCorrect: result.isCorrect,
        userAnswer: result.userAnswer,
      },
    ]);
    setIndex((i) => i + 1);
  }

  if (!sessionId) {
    return (
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>시험</h1>
        <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
          별점 가중치를 반영해 하루 45문제를 출제합니다. 등록된 단어가 적으면 한 단어가
          지나치게 반복되지 않도록 문제 수가 자동으로 줄어듭니다.
        </p>
        {errorMsg && <p style={{ color: '#dc2626', marginBottom: 10 }}>{errorMsg}</p>}
        <button className="btn" onClick={startExam} disabled={loading}>
          {loading ? '준비 중...' : '시험 시작'}
        </button>
      </div>
    );
  }

  if (submitted) {
    const correctCount = answers.filter((a) => a.isCorrect).length;
    const percent = answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0;
    return (
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>시험 완료</h1>
        <p style={{ marginBottom: '0.5rem' }}>
          {answers.length}문제 중 {correctCount}개 정답 ({percent}%)
        </p>
        <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
          결과를 반영해 각 단어의 별점이 갱신되었습니다.
        </p>
        <button className="btn" style={{ marginTop: '1rem' }} onClick={startExam}>
          다시 시험 보기
        </button>
      </div>
    );
  }

  if (finished) {
    return (
      <div>
        <p>{submitting ? '채점 중...' : '채점을 기다리는 중...'}</p>
        {errorMsg && (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ color: '#dc2626', marginBottom: 8 }}>{errorMsg}</p>
            <button
              className="btn"
              onClick={() => {
                setErrorMsg(null);
                // Re-running the effect resubmits the same answers.
                setAnswers((prev) => [...prev]);
              }}
            >
              다시 제출
            </button>
          </div>
        )}
      </div>
    );
  }

  const current = questions[index];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>시험</h1>
        <span style={{ color: '#6b7280' }}>
          {index + 1} / {questions.length}
        </span>
      </div>
      <ExamQuestion key={`${current.questionId}-${index}`} question={current} onAnswered={handleAnswered} />
    </div>
  );
}
