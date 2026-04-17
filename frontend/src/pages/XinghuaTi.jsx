import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import SakuraPetalsOverlay from '../components/SakuraPetalsOverlay';
import {
  XINGHUA_TI_DIMENSIONS,
  XINGHUA_TI_QUESTIONS,
  XINGHUA_TI_SCORING,
  XINGHUA_TI_STORAGE_KEY
} from '../constants/xinghuaTi';

function computeResult({ answersByNumber }) {
  const letterCounts = new Map();

  function add(letter) {
    if (!letter) return;
    letterCounts.set(letter, (letterCounts.get(letter) || 0) + 1);
  }

  for (const q of XINGHUA_TI_QUESTIONS) {
    const pick = answersByNumber[q.number];
    if (!pick) continue;
    const letter = XINGHUA_TI_SCORING[q.number]?.[pick];
    add(letter);
  }

  function count(letter) {
    return Number(letterCounts.get(letter) || 0);
  }

  function resolveDimension(dim) {
    const left = dim.left;
    const right = dim.right;
    const leftScore = count(left);
    const rightScore = count(right);
    if (leftScore > rightScore) return left;
    if (rightScore > leftScore) return right;

    // tie: look at core questions
    let leftCore = 0;
    let rightCore = 0;
    for (const qn of dim.tieCoreQuestions || []) {
      const pick = answersByNumber[qn];
      if (!pick) continue;
      const letter = XINGHUA_TI_SCORING[qn]?.[pick];
      if (letter === left) leftCore += 1;
      if (letter === right) rightCore += 1;
    }
    if (leftCore > rightCore) return left;
    if (rightCore > leftCore) return right;

    return dim.tieDefault;
  }

  const type = XINGHUA_TI_DIMENSIONS.map(resolveDimension).join('');
  return {
    type,
    counts: Object.fromEntries([...letterCounts.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))))
  };
}

export default function XinghuaTi() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [answersByNumber, setAnswersByNumber] = useState(() => {
    try {
      const raw = window.localStorage.getItem(XINGHUA_TI_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object' && parsed.answers && typeof parsed.answers === 'object') {
        return parsed.answers;
      }
    } catch {
      // ignore
    }
    return {};
  });

  const questions = XINGHUA_TI_QUESTIONS;
  const current = questions[index] || questions[0];
  const picked = answersByNumber[current?.number];

  const answeredCount = useMemo(() => {
    let c = 0;
    for (const q of questions) {
      if (answersByNumber[q.number]) c += 1;
    }
    return c;
  }, [answersByNumber, questions]);

  const percent = Math.round((answeredCount / questions.length) * 100);

  const persistDraft = (nextAnswers) => {
    try {
      window.localStorage.setItem(
        XINGHUA_TI_STORAGE_KEY,
        JSON.stringify({ answers: nextAnswers, updated_at: new Date().toISOString() })
      );
    } catch {
      // ignore
    }
  };

  const setPick = (letter) => {
    const next = { ...answersByNumber, [current.number]: letter };
    setAnswersByNumber(next);
    persistDraft(next);
  };

  const goNext = () => setIndex((prev) => Math.min(questions.length - 1, prev + 1));
  const goPrev = () => setIndex((prev) => Math.max(0, prev - 1));

  const handleSubmit = () => {
    if (answeredCount !== questions.length) {
      toast.error('请先完成全部题目');
      return;
    }
    const result = computeResult({ answersByNumber });
    try {
      window.localStorage.setItem(
        XINGHUA_TI_STORAGE_KEY,
        JSON.stringify({
          answers: answersByNumber,
          result,
          finished_at: new Date().toISOString()
        })
      );
    } catch {
      // ignore
    }
    navigate('/xinghua-ti/result', { replace: true });
  };

  return (
    <div className="relative min-h-screen bg-pagePink font-xihei text-slate-900 overflow-hidden py-8 px-3 sm:px-6">
      <SakuraPetalsOverlay baseCount={40} />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[rgba(241,228,232,0.12)]" aria-hidden />

      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative z-10 max-w-3xl mx-auto"
      >
        <div className="bg-cardIvory rounded-3xl border border-roseTint/60 shadow-sm p-7 sm:p-10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 pr-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#1a1a2e] font-ysong tracking-wide">
                来测你的南岭杏花ti
              </h1>
            </div>
            <button
              type="button"
              onClick={() => navigate('/xinghua-ti/result')}
              className="shrink-0 px-4 py-2 rounded-full border-2 border-roseTint/45 bg-white/80 hover:bg-roseLight/35 text-[#4a4a5e] text-sm sm:text-base font-bold transition"
            >
              查看南岭杏花ti
            </button>
          </div>

          <div className="mt-6">
            <div className="h-2.5 bg-rose-100/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-roseTint/75 via-ctaRose/45 to-roseLight"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[#7a7278] font-shsans text-right">
              进度 {answeredCount}/{questions.length}（{percent}%）
            </p>
          </div>

          <div className="mt-8 p-6 bg-white/80 rounded-[1.5rem] border border-roseTint/40">
            <div className="text-sm text-szured/70 font-black font-shsans mb-2">
              第 {current.number} 题 / 共 {questions.length} 题
            </div>
            <div className="text-lg sm:text-xl font-bold text-[#1a1a2e] leading-relaxed">
              {current.title}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3">
              {['A', 'B', 'C', 'D'].map((key) => {
                const active = picked === key;
                const text = current.options?.[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPick(key)}
                    className={`text-left p-4 rounded-2xl border-2 transition font-shsans leading-relaxed ${
                      active
                        ? 'border-szured/50 bg-roseLight text-szured shadow-sm'
                        : 'border-roseTint/40 bg-white hover:border-roseTint/70 text-[#4a4a5e]'
                    }`}
                  >
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-roseLight/80 border border-roseTint/35 text-szured font-black mr-3 align-middle">
                      {key}
                    </span>
                    <span className="align-middle">{text}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={goPrev}
              disabled={index === 0}
              className="flex-1 py-3 rounded-full border-2 border-roseTint/45 bg-white hover:bg-roseLight/35 text-[#4a4a5e] font-bold disabled:opacity-50 transition"
            >
              上一题
            </button>
            {index < questions.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  if (!picked) {
                    toast.error('请先选择一个选项');
                    return;
                  }
                  goNext();
                }}
                className="flex-[2] py-3 rounded-full bg-ctaRose hover:bg-ctaRoseHover text-white font-bold shadow-[0_8px_24px_rgba(224,154,173,0.28)] transition"
              >
                下一题
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="flex-[2] py-3 rounded-full bg-gradient-to-r from-szured to-ctaRose text-white font-bold shadow-[0_10px_28px_rgba(138,21,56,0.25)] transition"
              >
                查看结果
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

