import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api';
import SakuraPetalsOverlay from './SakuraPetalsOverlay';

const TXT = {
  hard: '\u786c\u7b5b\u9009',
  deep: '\u6df1\u5ea6\u95ee\u5377\u9875',
  settings: '\u5339\u914d\u8bbe\u7f6e',
  choose: '\u8bf7\u9009\u62e9',
  loadFail: '\u52a0\u8f7d\u95ee\u5377\u5931\u8d25',
  saveOk: '\u5df2\u4fdd\u5b58',
  doneTitle: '\u5339\u914d\u8bbe\u7f6e\u5df2\u5b8c\u6210',
  doneDesc: '\u4e0b\u6b21\u5373\u53ef\u4f9b\u5339\u914d\u548c\u5e94\u7528',
  resume: '\u68c0\u6d4b\u5230\u4e0a\u4e00\u6b21\u672a\u5b8c\u6210\u7684\u95ee\u5377\uff0c\u662f\u5426\u8981\u63a5\u7740\u4e0a\u4e00\u6b21\u7ee7\u7eed\u586b\u5199\uff1f',
  yes: '\u662f',
  no: '\u5426',
  next: '\u4fdd\u5b58\u5e76\u8fdb\u5165\u4e0b\u4e00\u6b65',
  saveAll: '\u4fdd\u5b58\u6240\u6709\u95ee\u5377',
  progress: '\u603b\u8fdb\u5ea6'
};

const STEPS = [
  { key: 'hard', label: TXT.hard },
  { key: 'deep', label: TXT.deep },
  { key: 'settings', label: TXT.settings }
];

const SCALE_5_LR = [
  { leftValue: -2, label: '2' },
  { leftValue: -1, label: '1' },
  { leftValue: 0, label: '0' },
  { leftValue: 1, label: '1' },
  { leftValue: 2, label: '2' }
];

function emptyPayload() {
  return {
    hard_filter: { target_gender: '', age_diff_older_max: null, age_diff_younger_max: null, accept_smoking: null },
    deep_survey: {},
    match_settings: { share_contact_with_match: false, match_contact_detail: '', auto_participate_weekly_match: true }
  };
}

function hasAnyDeepAnswer(deepSurvey) {
  if (!deepSurvey || typeof deepSurvey !== 'object') return false;
  return Object.keys(deepSurvey).some((k) => /^q\d+$/.test(k));
}

export default function MatchQuestionnaireForm({ questionnaireType }) {
  const [initLoading, setInitLoading] = useState(true);
  const [configLoading, setConfigLoading] = useState(true);
  const [step, setStep] = useState(0); // 0 hard, 1 deep, 2 settings
  const [completed, setCompleted] = useState(false);
  const [payload, setPayload] = useState(emptyPayload());
  const [saving, setSaving] = useState(false);
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [deepModuleIndex, setDeepModuleIndex] = useState(1);

  const [config, setConfig] = useState(null);

  const loadedRef = useRef(false);
  const skipNextAutosaveRef = useRef(false);

  const saveEndpoint = questionnaireType === 'friend' ? '/friend-questionnaire' : '/love-questionnaire';

  const fetchConfig = useCallback(async () => {
    const res = await api.get('/match-questionnaire/config', {
      params: { type: questionnaireType }
    });
    const c = res.data?.data || {};
    return c;
  }, [questionnaireType]);

  const hasDraftProgress = useCallback((pl, done) => {
    if (done) return false;
    const h = pl?.hard_filter || {};
    const m = pl?.match_settings || {};
    if (h.target_gender) return true;
    if (h.accept_smoking === true || h.accept_smoking === false) return true;
    if (Number.isInteger(h.age_diff_older_max) || Number.isInteger(h.age_diff_younger_max)) return true;
    if (m.share_contact_with_match) return true;
    if ((m.match_contact_detail || '').trim()) return true;
    if (m.auto_participate_weekly_match === false) return true;
    return hasAnyDeepAnswer(pl?.deep_survey);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setConfigLoading(true);
        const c = await fetchConfig();
        if (cancelled) return;
        setConfig(c);

        const draftRes = await api.get(saveEndpoint, { skipAuthRedirect: true });
        const d = draftRes.data?.data || {};
        const mergedPayload = emptyPayload(); // shape base
        const serverPayload = d.payload && typeof d.payload === 'object' ? d.payload : {};
        mergedPayload.hard_filter = { ...mergedPayload.hard_filter, ...(serverPayload.hard_filter || {}) };
        mergedPayload.deep_survey = serverPayload.deep_survey && typeof serverPayload.deep_survey === 'object' ? serverPayload.deep_survey : {};
        mergedPayload.match_settings = { ...mergedPayload.match_settings, ...(serverPayload.match_settings || {}) };

        if (cancelled) return;
        skipNextAutosaveRef.current = true;
        setPayload(mergedPayload);

        const st = typeof d.current_step === 'number' ? d.current_step : 0;
        const safeStep = Math.min(2, Math.max(0, st));
        setStep(safeStep);

        const done = Boolean(d.completed);
        setCompleted(done);

        if (!done && (safeStep > 0 || hasDraftProgress(mergedPayload, done))) {
          setResumeOpen(true);
          setDeepModuleIndex(1);
        } else {
          setResumeOpen(false);
        }

        loadedRef.current = true;
      } catch (e) {
        if (!cancelled) {
          toast.error(TXT.loadFail);
        }
      } finally {
        if (!cancelled) {
          setConfigLoading(false);
          setInitLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchConfig, hasDraftProgress, saveEndpoint]);

  const persist = useCallback(async (nextPayload, nextStep, finalize) => {
    setSaving(!finalize);
    try {
      await api.post(saveEndpoint, {
        hard_filter: nextPayload.hard_filter,
        deep_survey: nextPayload.deep_survey,
        match_settings: nextPayload.match_settings,
        current_step: nextStep,
        finalize
      });
      if (finalize) {
        setCompleted(true);
        toast.success(TXT.saveOk);
      }
    } catch {
      // interceptor handles toast
    } finally {
      setSaving(false);
    }
  }, [saveEndpoint]);

  useEffect(() => {
    if (!loadedRef.current || initLoading || completed) return;
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      persist(payload, step, false);
    }, 600);
    return () => clearTimeout(timer);
  }, [payload, step, completed, initLoading, persist]);

  const progressPercent = useMemo(() => Math.round(((step + 1) / STEPS.length) * 100), [step]);

  const updateHard = (patch) => setPayload((prev) => ({ ...prev, hard_filter: { ...prev.hard_filter, ...patch } }));
  const updateDeep = (patch) => setPayload((prev) => ({ ...prev, deep_survey: { ...prev.deep_survey, ...patch } }));
  const updateSettings = (patch) => setPayload((prev) => ({ ...prev, match_settings: { ...prev.match_settings, ...patch } }));

  const hardOk = useMemo(() => {
    const h = payload.hard_filter || {};
    return Boolean(
      h.target_gender
        && Number.isInteger(h.age_diff_older_max)
        && Number.isInteger(h.age_diff_younger_max)
        && (h.accept_smoking === true || h.accept_smoking === false)
    );
  }, [payload]);

  const deepModules = config?.deep_modules || [];
  const deepQuestionNums = useMemo(() => {
    const nums = [];
    for (const m of deepModules) {
      const qs = Array.isArray(m.questions) ? m.questions : [];
      for (const q of qs) {
        if (Number.isInteger(q.question_number)) nums.push(q.question_number);
      }
    }
    return nums;
  }, [deepModules]);

  const deepOk = useMemo(() => {
    if (!deepQuestionNums.length) return false;
    for (const n of deepQuestionNums) {
      const key = `q${n}`;
      const value = payload.deep_survey?.[key];
      if (!Number.isInteger(value) || value < -2 || value > 2) return false;
    }
    return true;
  }, [deepQuestionNums, payload.deep_survey]);

  const settingsOk = useMemo(() => {
    const m = payload.match_settings || {};
    if (!m.share_contact_with_match) return true;
    const len = (m.match_contact_detail || '').trim().length;
    return len >= 1 && len <= 20;
  }, [payload.match_settings]);

  const currentDeepModule = useMemo(() => {
    if (!Array.isArray(deepModules) || deepModules.length === 0) return null;
    return deepModules.find((m) => m.module_index === deepModuleIndex) || deepModules[0] || null;
  }, [deepModules, deepModuleIndex]);

  const currentDeepModuleComplete = useMemo(() => {
    if (!currentDeepModule) return false;
    const qs = Array.isArray(currentDeepModule.questions) ? currentDeepModule.questions : [];
    if (qs.length === 0) return false;
    for (const q of qs) {
      const key = `q${q.question_number}`;
      const value = payload.deep_survey?.[key];
      if (!Number.isInteger(value) || value < -2 || value > 2) return false;
    }
    return true;
  }, [currentDeepModule, payload.deep_survey]);

  const moduleProgress = useMemo(() => {
    const map = new Map();
    for (const m of deepModules) {
      const qs = Array.isArray(m.questions) ? m.questions : [];
      const total = qs.length;
      let answered = 0;
      for (const q of qs) {
        const key = `q${q.question_number}`;
        const value = payload.deep_survey?.[key];
        if (Number.isInteger(value) && value >= -2 && value <= 2) answered += 1;
      }
      map.set(m.module_index, { total, answered });
    }
    return map;
  }, [deepModules, payload.deep_survey]);

  if (initLoading || configLoading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-pagePink">
        <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.55 }}>
          <Loader2 className="w-10 h-10 animate-spin text-szured" />
        </motion.div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="relative min-h-screen bg-pagePink flex items-center justify-center p-4 font-xihei">
        <div className="absolute inset-0 z-[1] bg-[rgba(241,228,232,0.1)] pointer-events-none" aria-hidden />
        <div className="relative z-10 bg-cardIvory rounded-3xl p-10 max-w-md text-center shadow-lg border border-roseTint/60">
          <h2 className="text-2xl font-bold text-[#1a1a2e] mb-2 font-ysong">{TXT.doneTitle}</h2>
          <p className="font-shsans font-light text-[#4a4a5e] leading-relaxed">{TXT.doneDesc}</p>
        </div>
      </div>
    );
  }

  const renderHardQuestion = (item) => {
    const key = item.options_json?.payload_key;
    const kind = item.question_kind;
    const stem = item.question_stem || '';
    const title = item.question_title || '';
    if (kind === 'select') {
      const options = Array.isArray(item.options_json?.choices) ? item.options_json.choices : [];
      const value = payload.hard_filter?.[key];
      const selectValue = value === null || value === undefined ? '' : String(value);
      return (
        <div className="space-y-4" key={`hard-${item.id}`}>
          <div>
            <p className="text-sm font-bold text-[#1a1a2e] mb-1 font-ysong">{item.question_number}. {title}</p>
            {stem ? <p className="text-xs text-slate-500 mb-2">{stem}</p> : null}
            <select
              value={selectValue}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  updateHard({ [key]: null });
                  return;
                }
                const picked = options.find((o) => String(o.value) === String(raw));
                // target_gender is string; age_diff is number.
                updateHard({ [key]: picked ? picked.value : raw });
              }}
              className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-roseTint/40 focus:border-szured outline-none font-shsans"
            >
              <option value="" disabled>{TXT.choose}</option>
              {options.map((o) => (
                <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      );
    }

    if (kind === 'toggle') {
      const leftText = item.left_option_text || TXT.no;
      const rightText = item.right_option_text || TXT.yes;
      const leftValue = item.options_json?.left_value;
      const rightValue = item.options_json?.right_value;
      const current = payload.hard_filter?.[key];
      const leftOn = current === leftValue;
      const rightOn = current === rightValue;
      return (
        <div className="space-y-3" key={`hard-${item.id}`}>
          <p className="text-sm font-bold text-[#1a1a2e] mb-1 font-ysong">{item.question_number}. {title}</p>
          {stem ? <p className="text-xs text-slate-500">{stem}</p> : null}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => updateHard({ [key]: leftValue })}
              className={`flex-1 py-3 rounded-2xl border-2 font-semibold transition ${
                leftOn ? 'border-szured/50 bg-roseLight text-szured' : 'border-roseTint/45 bg-white text-[#4a4a5e] hover:border-roseTint'
              }`}
            >
              {leftText}
            </button>
            <button
              type="button"
              onClick={() => updateHard({ [key]: rightValue })}
              className={`flex-1 py-3 rounded-2xl border-2 font-semibold transition ${
                rightOn ? 'border-szured/50 bg-roseLight text-szured' : 'border-roseTint/45 bg-white text-[#4a4a5e] hover:border-roseTint'
              }`}
            >
              {rightText}
            </button>
          </div>
        </div>
      );
    }

    // fallback: just show title
    return (
      <div key={`hard-${item.id}`} className="p-4 border border-roseTint/40 rounded-2xl bg-white/70">
        {item.question_number}. {title}
      </div>
    );
  };

  const renderSettingsQuestion = (item) => {
    const key = item.options_json?.payload_key;
    const kind = item.question_kind;
    const stem = item.question_stem || '';
    const title = item.question_title || '';
    if (kind === 'toggle') {
      const leftText = item.left_option_text || TXT.no;
      const rightText = item.right_option_text || TXT.yes;
      const leftValue = item.options_json?.left_value;
      const rightValue = item.options_json?.right_value;
      const current = payload.match_settings?.[key];
      const leftOn = current === leftValue;
      const rightOn = current === rightValue;
      return (
        <div key={`settings-${item.id}`} className="space-y-3">
          <p className="text-sm font-bold text-[#1a1a2e] mb-1 font-ysong">{item.question_number}. {title}</p>
          {stem ? <p className="text-xs text-slate-500">{stem}</p> : null}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => updateSettings({ [key]: leftValue })}
              className={`flex-1 py-3 rounded-2xl border-2 font-semibold transition ${
                leftOn ? 'border-szured/50 bg-roseLight text-szured' : 'border-roseTint/45 bg-white text-[#4a4a5e] hover:border-roseTint'
              }`}
            >
              {leftText}
            </button>
            <button
              type="button"
              onClick={() => updateSettings({ [key]: rightValue })}
              className={`flex-1 py-3 rounded-2xl border-2 font-semibold transition ${
                rightOn ? 'border-szured/50 bg-roseLight text-szured' : 'border-roseTint/45 bg-white text-[#4a4a5e] hover:border-roseTint'
              }`}
            >
              {rightText}
            </button>
          </div>
        </div>
      );
    }

    if (kind === 'text') {
      if (key === 'match_contact_detail' && !payload.match_settings?.share_contact_with_match) {
        return null;
      }
      const value = payload.match_settings?.[key] ?? '';
      return (
        <div key={`settings-${item.id}`} className="space-y-2">
          <p className="text-sm font-bold text-[#1a1a2e] font-ysong">{item.question_number}. {title}</p>
          {stem ? <p className="text-xs text-slate-500">{stem}</p> : null}
          <input
            type="text"
            value={value}
            maxLength={20}
            onChange={(e) => updateSettings({ [key]: e.target.value })}
            className="w-full px-5 py-4 rounded-2xl border-2 border-roseTint/40 focus:border-szured outline-none bg-white font-shsans"
            placeholder={item.options_json?.placeholder || TXT.choose}
          />
          {key === 'match_contact_detail' && payload.match_settings?.share_contact_with_match ? (
            <p className="text-xs text-[#4a4a5e]/80 font-shsans">已输入 {String((value || '').length)}/20</p>
          ) : null}
        </div>
      );
    }

    return null;
  };

  const renderDeepQuestion = (q) => {
    const value = payload.deep_survey?.[`q${q.question_number}`];
    return (
      <div key={`deep-q-${q.id || q.question_number}`} className="p-6 bg-white rounded-[1.5rem] border border-roseTint/40 shadow-sm">
        <div className="text-base sm:text-lg text-[#1a1a2e] font-bold leading-relaxed mb-4">
          <span className="text-szured/60 font-black mr-2 text-xl">{q.question_number}.</span>
          {q.question_title}
        </div>
        {q.question_stem ? (
          <div className="text-sm text-slate-700 font-medium mb-4 whitespace-pre-wrap">{q.question_stem}</div>
        ) : null}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">左</p>
            <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap">{q.left_option_text}</p>
          </div>
          <div className="md:text-right">
            <p className="text-xs font-semibold text-slate-500 mb-2 md:text-right">右</p>
            <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap md:text-right">{q.right_option_text}</p>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold text-slate-500 mb-2 text-center">（2，1，0，1，2）</p>
          <div className="grid grid-cols-5 gap-2 max-w-[520px] mx-auto">
            {SCALE_5_LR.map((s) => {
              const selected = value === s.leftValue;
              return (
                <button
                  key={s.leftValue}
                  type="button"
                  onClick={() => updateDeep({ [`q${q.question_number}`]: s.leftValue })}
                  className={`h-10 rounded-xl border-2 text-xs font-bold transition ${
                    selected
                      ? 'border-szured/50 bg-roseLight text-szured shadow-sm'
                      : 'border-roseTint/35 bg-white text-[#4a4a5e] hover:border-roseTint'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative min-h-screen bg-pagePink font-xihei text-slate-900 py-8 px-3 sm:px-6 overflow-hidden">
      <SakuraPetalsOverlay baseCount={32} />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[rgba(241,228,232,0.1)]" aria-hidden />

      {resumeOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1a1a2e]/40 p-4 backdrop-blur-[2px]">
          <div className="bg-cardIvory rounded-2xl shadow-xl max-w-md w-full p-8 border border-roseTint/60">
            <p className="text-[#1a1a2e] font-bold text-lg mb-6 text-center font-ysong">{TXT.resume}</p>
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 py-3 rounded-full border-2 border-roseTint/50 font-bold text-szured bg-white hover:bg-roseLight/50 transition-colors"
                onClick={async () => {
                  const fresh = emptyPayload();
                  setPayload(fresh);
                  setStep(0);
                  setDeepModuleIndex(1);
                  skipNextAutosaveRef.current = true;
                  setResumeOpen(false);
                  try {
                    await api.post(saveEndpoint, {
                      hard_filter: fresh.hard_filter,
                      deep_survey: fresh.deep_survey,
                      match_settings: fresh.match_settings,
                      current_step: 0,
                      finalize: false
                    });
                  } catch {
                    // ignore
                  }
                }}
              >
                {TXT.no}
              </button>
              <button
                type="button"
                className="flex-1 py-3 rounded-full bg-ctaRose text-white font-bold hover:bg-ctaRoseHover shadow-[0_8px_24px_rgba(224,154,173,0.28)] transition-colors"
                onClick={() => setResumeOpen(false)}
              >
                {TXT.yes}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed left-0 right-0 z-40 glass border-b border-roseTint/35 shadow-sm top-[72px] sm:top-[88px]">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex gap-1 sm:gap-2 justify-between mb-2">
            {STEPS.map((s, idx) => (
              <button
                key={s.key}
                type="button"
                onClick={async () => {
                  setDeepModuleIndex(1);
                  skipNextAutosaveRef.current = true;
                  setStep(idx);
                  await persist(payload, idx, false);
                }}
                className={`flex-1 text-center text-xs sm:text-sm py-2.5 rounded-full transition font-ysong font-semibold tracking-wide ${
                  step === idx
                    ? 'bg-roseLight text-[#9e5d72] border border-roseTint/70 shadow-sm'
                    : 'bg-white/65 text-[#7c6673] border border-roseTint/25 hover:bg-roseLight/45 hover:text-[#6f5b66]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="h-1.5 bg-rose-100/60 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-roseTint/75 via-ctaRose/40 to-roseLight"
              initial={false}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="text-xs text-[#7a7278] mt-1.5 text-right font-ysong">{TXT.progress} {progressPercent}%</p>
        </div>
      </div>

      <div className="h-[120px] sm:h-[132px]" />

      <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="max-w-4xl mx-auto relative z-10">
        {step === 0 ? (
          <section className="bg-cardIvory rounded-3xl border border-roseTint/60 shadow-sm hover:shadow-md transition-shadow p-7 sm:p-10">
            <h2 className="text-2xl font-bold text-[#1a1a2e] mb-8 font-ysong tracking-wide">{TXT.hard}</h2>
            <div className="space-y-8 max-w-xl">
              {(config?.hard_items || []).map((it) => renderHardQuestion(it))}
            </div>
            <div className="mt-10">
              <button
                type="button"
                disabled={!hardOk || saving}
                onClick={async () => {
                  skipNextAutosaveRef.current = true;
                  const next = 1;
                  setStep(next);
                  await persist(payload, next, false);
                }}
                className="w-full py-4 bg-ctaRose hover:bg-ctaRoseHover text-white rounded-full font-bold text-lg disabled:opacity-50 shadow-[0_8px_24px_rgba(224,154,173,0.32)] transition-all hover:-translate-y-0.5"
              >
                {saving ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : TXT.next}
              </button>
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="bg-cardIvory rounded-3xl border border-roseTint/60 shadow-sm hover:shadow-md transition-shadow p-7 sm:p-10">
            <h2 className="text-2xl font-bold text-[#1a1a2e] mb-6 font-ysong tracking-wide">{TXT.deep}</h2>

            {/* 小进度条：点击可跳转三个模块 */}
            <div className="mb-6">
              <div className="h-2.5 bg-rose-100/60 rounded-full overflow-hidden flex gap-0">
                {deepModules.slice(0, 3).map((m) => {
                  const p = moduleProgress.get(m.module_index) || { total: 0, answered: 0 };
                  const pct = p.total > 0 ? p.answered / p.total : 0;
                  const active = m.module_index === deepModuleIndex;
                  return (
                    <button
                      key={`mod-bar-${m.module_index}`}
                      type="button"
                      onClick={() => setDeepModuleIndex(m.module_index)}
                      className="flex-1 relative"
                    >
                      <div className="absolute inset-0 bg-white/40 pointer-events-none" />
                      <div
                        className={`absolute inset-y-0 left-0 bg-gradient-to-r from-roseTint/70 to-ctaRose/55 pointer-events-none ${active ? 'opacity-100' : 'opacity-70'}`}
                        style={{ width: `${Math.round(pct * 100)}%` }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {currentDeepModule ? (
              <div className="space-y-6">
                <div className="p-5 bg-white/70 border border-roseTint/35 rounded-3xl">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-lg font-black text-[#1a1a2e] font-ysong">
                      {deepModuleIndex}. {currentDeepModule.title}
                    </p>
                    <p className="text-xs font-ysong text-slate-500">
                      {(() => {
                        const p = moduleProgress.get(currentDeepModule.module_index) || { total: 0, answered: 0 };
                        return `\u5df2\u5b8c\u6210${p.answered}/${p.total}\u9898`;
                      })()}
                    </p>
                  </div>
                </div>

                <div className="space-y-8">
                  {currentDeepModule.questions.map((q) => renderDeepQuestion(q))}
                </div>
              </div>
            ) : null}

            <div className="mt-12">
              <button
                type="button"
                disabled={!currentDeepModuleComplete || saving}
                onClick={async () => {
                  skipNextAutosaveRef.current = true;
                  // Deep step is 3 modules. "下一步" means next module first, then settings.
                  if (deepModuleIndex < 3) {
                    setDeepModuleIndex((prev) => Math.min(3, prev + 1));
                    await persist(payload, step, false);
                    return;
                  }
                  // module 3 complete -> proceed to settings
                  const next = 2;
                  setStep(next);
                  await persist(payload, next, false);
                }}
                className="w-full py-4 bg-ctaRose hover:bg-ctaRoseHover text-white rounded-full font-bold text-lg disabled:opacity-50 shadow-[0_8px_24px_rgba(224,154,173,0.32)] transition-all hover:-translate-y-0.5"
              >
                {saving ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : TXT.next}
              </button>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="bg-cardIvory rounded-3xl border border-roseTint/60 shadow-sm hover:shadow-md transition-shadow p-7 sm:p-10">
            <h2 className="text-2xl font-bold text-[#1a1a2e] mb-8 font-ysong tracking-wide">{TXT.settings}</h2>
            <div className="space-y-8 max-w-xl mx-auto">
              {(config?.settings_items || []).map((it) => renderSettingsQuestion(it))}
            </div>
            <div className="mt-12 flex justify-center">
              <button
                type="button"
                disabled={finalizeLoading || !settingsOk}
                onClick={async () => {
                  setFinalizeLoading(true);
                  try {
                    skipNextAutosaveRef.current = true;
                    await persist(payload, step, true);
                  } finally {
                    setFinalizeLoading(false);
                  }
                }}
                className="px-12 py-4 bg-gradient-to-r from-szured to-ctaRose text-white rounded-full font-bold text-lg shadow-[0_10px_28px_rgba(138,21,56,0.25)] disabled:opacity-50 hover:opacity-95 transition-opacity"
              >
                {finalizeLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : TXT.saveAll}
              </button>
            </div>
          </section>
        ) : null}
      </motion.div>
    </div>
  );
}

