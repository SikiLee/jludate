import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  doneTitle: '\u60a8\u5df2\u5b8c\u6210\u5339\u914d\u8bbe\u7f6e\uff0c\u662f\u5426\u7ee7\u7eed\u4fee\u6539\uff1f',
  modify: '\u4fee\u6539',
  backHome: '\u56de\u5230\u9996\u9875',
  prev: '\u56de\u5230\u4e0a\u4e00\u6b65',
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

function sanitizeAgeDiffStem(key, stem) {
  if (typeof stem !== 'string') return '';
  if (key === 'age_diff_older_max' || key === 'age_diff_younger_max') {
    return '';
  }
  return stem;
}

function resolveQuestionTitle(item) {
  const key = item?.options_json?.payload_key;
  const rawTitle = (item?.question_title || item?.options_json?.title || '').trim();
  if (key === 'age_diff_older_max') return '最多可接受对方比我大几级';
  if (key === 'age_diff_younger_max') return '最多可接受对方比我小几级';
  return rawTitle;
}

function resolveModuleIndex(module, fallbackIndex) {
  const raw = module?.module_index ?? module?.moduleIndex ?? fallbackIndex;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallbackIndex;
}

function emptyPayload() {
  return {
    hard_filter: {
      target_gender: '',
      accept_cross_campus: null,
      age_diff_older_max: null,
      age_diff_younger_max: null,
      accept_smoking: null
    },
    deep_survey: {},
    match_settings: {
      share_contact_with_match: false,
      match_contact_detail: '',
      include_message_to_partner: false,
      message_to_partner: '',
      auto_participate_weekly_match: true
    }
  };
}

function hasAnyDeepAnswer(deepSurvey) {
  if (!deepSurvey || typeof deepSurvey !== 'object') return false;
  return Object.keys(deepSurvey).some((k) => /^q\d+$/.test(k));
}

export default function MatchQuestionnaireForm({ questionnaireType }) {
  const navigate = useNavigate();
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
  const navScrollRef = useRef(false);

  const scrollToTop = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      });
    });
  }, []);

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

  useEffect(() => {
    if (!navScrollRef.current) {
      return;
    }
    navScrollRef.current = false;
    scrollToTop();
  }, [step, deepModuleIndex, scrollToTop]);

  const totalProgress = useMemo(() => {
    // Treat deep step as 3 modules for total progress:
    // hard(1) -> deep module 1(2) -> module 2(3) -> module 3(4) -> settings(5)
    const totalUnits = 5;
    let unitIndex = 1;
    if (step === 0) {
      unitIndex = 1;
    } else if (step === 1) {
      const moduleUnit = Math.min(3, Math.max(1, Number(deepModuleIndex) || 1));
      unitIndex = 1 + moduleUnit; // 2..4
    } else {
      unitIndex = 5;
    }
    const percent = Math.round((unitIndex / totalUnits) * 100);
    return { unitIndex, totalUnits, percent };
  }, [step, deepModuleIndex]);

  const progressPercent = totalProgress.percent;

  const updateHard = (patch) => setPayload((prev) => ({ ...prev, hard_filter: { ...prev.hard_filter, ...patch } }));
  const updateDeep = (patch) => setPayload((prev) => ({ ...prev, deep_survey: { ...prev.deep_survey, ...patch } }));
  const updateSettings = (patch) => setPayload((prev) => ({ ...prev, match_settings: { ...prev.match_settings, ...patch } }));

  const hardOk = useMemo(() => {
    const h = payload.hard_filter || {};
    return Boolean(
      h.target_gender
        && (h.accept_cross_campus === true || h.accept_cross_campus === false)
        && Number.isInteger(h.age_diff_older_max)
        && Number.isInteger(h.age_diff_younger_max)
        && (h.accept_smoking === true || h.accept_smoking === false)
    );
  }, [payload]);

  const deepModules = config?.deep_modules || [];

  const effectiveHardItems = useMemo(() => {
    const items = Array.isArray(config?.hard_items) ? config.hard_items : [];
    if (items.length === 0) return items;

    const hasCrossCampus = items.some((it) => it?.options_json?.payload_key === 'accept_cross_campus');
    if (hasCrossCampus) return items;

    const injected = {
      id: 'injected-accept_cross_campus',
      page_key: 'hard',
      question_number: 2,
      question_kind: 'toggle',
      question_title: '\u662f\u5426\u63a5\u53d7\u8de8\u6821\u533a',
      question_stem: '',
      left_option_text: '\u662f',
      right_option_text: '\u5426',
      options_json: {
        payload_key: 'accept_cross_campus',
        left_value: true,
        right_value: false
      }
    };

    const next = [];
    for (const it of items) {
      next.push(it);
      const key = it?.options_json?.payload_key;
      if (key === 'target_gender') {
        next.push(injected);
      }
    }
    // If we can't find the anchor, append to end (still better than missing).
    if (!items.some((it) => it?.options_json?.payload_key === 'target_gender')) {
      next.push(injected);
    }
    return next;
  }, [config?.hard_items]);
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

  const messageOk = useMemo(() => {
    const m = payload.match_settings || {};
    if (!m.include_message_to_partner) return true;
    const msg = typeof m.message_to_partner === 'string' ? m.message_to_partner.trim() : '';
    const len = [...msg].length;
    return len >= 1 && len <= 200;
  }, [payload.match_settings]);

  const effectiveSettingsItems = useMemo(() => {
    const items = Array.isArray(config?.settings_items) ? config.settings_items : [];
    if (items.length === 0) {
      return items;
    }

    const byKey = new Map();
    const others = [];
    for (const it of items) {
      const key = it?.options_json?.payload_key;
      if (key) {
        byKey.set(key, it);
      } else {
        others.push(it);
      }
    }

    const includeToggle = byKey.get('include_message_to_partner') || {
      id: 'injected-include_message_to_partner',
      page_key: 'settings',
      question_number: 3,
      question_kind: 'toggle',
      question_title: '\u662f\u5426\u6709\u5bf9\u5bf9\u65b9\u60f3\u8bf4\u7684\u8bdd',
      question_stem: '',
      left_option_text: '\u5426',
      right_option_text: '\u662f',
      options_json: {
        payload_key: 'include_message_to_partner',
        left_value: false,
        right_value: true
      }
    };
    const messageTextarea = byKey.get('message_to_partner') || {
      id: 'injected-message_to_partner',
      page_key: 'settings',
      question_number: 4,
      question_kind: 'textarea',
      question_title: '\u5bf9\u5bf9\u65b9\u60f3\u8bf4\u7684\u8bdd\uff08\u5fc5\u586b\uff0c1\uff5e200\u5b57\uff09',
      question_stem: '',
      left_option_text: '',
      right_option_text: '',
      options_json: {
        payload_key: 'message_to_partner',
        placeholder: '\u8bf7\u8f93\u5165\u5bf9\u5bf9\u65b9\u60f3\u8bf4\u7684\u8bdd'
      }
    };

    // Enforce UX order so child inputs appear under the right toggles:
    // share_contact -> match_contact_detail -> include_message -> message_to_partner -> auto_weekly
    const orderedKeys = [
      'share_contact_with_match',
      'match_contact_detail',
      'include_message_to_partner',
      'message_to_partner',
      'auto_participate_weekly_match'
    ];

    const ordered = [];
    for (const key of orderedKeys) {
      if (key === 'include_message_to_partner') {
        ordered.push(includeToggle);
        continue;
      }
      if (key === 'message_to_partner') {
        ordered.push(messageTextarea);
        continue;
      }
      const it = byKey.get(key);
      if (it) ordered.push(it);
    }

    // Append any other settings items not covered above (stable)
    for (const it of items) {
      const key = it?.options_json?.payload_key;
      if (key && orderedKeys.includes(key)) continue;
      if (key === 'include_message_to_partner' || key === 'message_to_partner') continue;
      if (!key) continue;
      ordered.push(it);
    }
    return [...ordered, ...others];
  }, [config?.settings_items]);

  const currentDeepModule = useMemo(() => {
    if (!Array.isArray(deepModules) || deepModules.length === 0) return null;
    return deepModules.find((m, idx) => resolveModuleIndex(m, idx + 1) === deepModuleIndex) || deepModules[0] || null;
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
    for (let idx = 0; idx < deepModules.length; idx += 1) {
      const m = deepModules[idx];
      const moduleIndex = resolveModuleIndex(m, idx + 1);
      const qs = Array.isArray(m.questions) ? m.questions : [];
      const total = qs.length;
      let answered = 0;
      for (const q of qs) {
        const key = `q${q.question_number}`;
        const value = payload.deep_survey?.[key];
        if (Number.isInteger(value) && value >= -2 && value <= 2) answered += 1;
      }
      map.set(moduleIndex, { total, answered });
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
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1a1a2e] mb-2 font-shsans tracking-wide">
            您已完成匹配设置
          </h2>
          <p className="text-sm sm:text-base text-[#4a4a5e] font-shsans mb-8">
            是否继续修改？
          </p>
          <div className="flex gap-4">
            <button
              type="button"
              className="flex-1 py-3 rounded-full bg-ctaRose text-white font-bold hover:bg-ctaRoseHover shadow-[0_8px_24px_rgba(224,154,173,0.28)] transition-colors"
              onClick={() => {
                skipNextAutosaveRef.current = true;
                setCompleted(false);
                setStep(0);
                setDeepModuleIndex(1);
              }}
            >
              {TXT.modify}
            </button>
            <button
              type="button"
              className="flex-1 py-3 rounded-full border-2 border-roseTint/50 font-bold text-szured bg-white hover:bg-roseLight/50 transition-colors"
              onClick={() => navigate('/')}
            >
              {TXT.backHome}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderHardQuestion = (item) => {
    const key = item.options_json?.payload_key;
    const kind = item.question_kind;
    const title = resolveQuestionTitle(item);
    const stem = sanitizeAgeDiffStem(key, item.question_stem || '');
    const titlePrefix = (() => {
      if (key === 'age_diff_younger_max') return ''; // no number, but keep alignment
      if (key === 'age_diff_older_max') return '3.'; // force number 3
      return `${item.question_number}.`;
    })();
    if (kind === 'select') {
      const options = Array.isArray(item.options_json?.choices) ? item.options_json.choices : [];
      const value = payload.hard_filter?.[key];
      const selectValue = value === null || value === undefined ? '' : String(value);
      return (
        <div className="space-y-4" key={`hard-${item.id}`}>
          <div>
            <p className="text-sm font-bold text-[#1a1a2e] mb-1 font-shsans flex items-baseline gap-2">
              <span className="inline-block w-6 text-szured/60 font-black" aria-hidden>
                {titlePrefix}
              </span>
              <span className="flex-1">{title}</span>
            </p>
            {stem ? <p className="text-sm text-[#4a4a5e] mb-2 font-shsans">{stem}</p> : null}
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
          <p className="text-sm font-bold text-[#1a1a2e] mb-1 font-shsans flex items-baseline gap-2">
            <span className="inline-block w-6 text-szured/60 font-black" aria-hidden>
              {titlePrefix}
            </span>
            <span className="flex-1">{title}</span>
          </p>
          {stem ? <p className="text-sm text-[#4a4a5e] font-shsans">{stem}</p> : null}
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
    const title = resolveQuestionTitle(item);
    if (kind === 'toggle') {
      const leftText = item.left_option_text || TXT.no;
      const rightText = item.right_option_text || TXT.yes;
      const leftValue = item.options_json?.left_value;
      const rightValue = item.options_json?.right_value;
      const current = key === 'auto_participate_weekly_match'
        ? (payload.match_settings?.[key] ?? true)
        : payload.match_settings?.[key];
      const leftOn = current === leftValue;
      const rightOn = current === rightValue;
      return (
        <div key={`settings-${item.id}`} className="space-y-3">
          <p className="text-sm font-bold text-[#1a1a2e] mb-1 font-shsans">{item.question_number}. {title}</p>
          {stem ? <p className="text-sm text-[#4a4a5e] font-shsans">{stem}</p> : null}
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
        <div
          key={`settings-${item.id}`}
          className={`space-y-2 ${key === 'match_contact_detail' ? 'ml-3 pl-3 border-l-2 border-roseTint/25' : ''}`}
        >
          <p className="text-sm font-bold text-[#1a1a2e] font-shsans">
            {key === 'match_contact_detail' ? title : `${item.question_number}. ${title}`}
          </p>
          {stem ? <p className="text-sm text-[#4a4a5e] font-shsans">{stem}</p> : null}
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

    if (kind === 'textarea') {
      if (key === 'message_to_partner' && !payload.match_settings?.include_message_to_partner) {
        return null;
      }
      const value = payload.match_settings?.[key] ?? '';
      const trimmed = typeof value === 'string' ? value : '';
      const count = [...trimmed].length;
      return (
        <div key={`settings-${item.id}`} className="space-y-2 ml-3 pl-3 border-l-2 border-roseTint/25">
          <p className="text-sm font-bold text-[#1a1a2e] font-shsans">{title}</p>
          {stem ? <p className="text-sm text-[#4a4a5e] font-shsans">{stem}</p> : null}
          <textarea
            value={trimmed}
            maxLength={200}
            rows={4}
            onChange={(e) => updateSettings({ [key]: e.target.value })}
            className="w-full px-5 py-4 rounded-2xl border-2 border-roseTint/40 focus:border-szured outline-none bg-white font-shsans resize-none leading-relaxed"
            placeholder={item.options_json?.placeholder || '请输入（1～200字）'}
          />
          <p className="text-xs text-[#4a4a5e]/80 font-shsans text-right">已输入 {String(count)}/200</p>
        </div>
      );
    }

    return null;
  };

  const renderDeepQuestion = (q) => {
    const value = payload.deep_survey?.[`q${q.question_number}`];
    const matchTypeKey = `q${q.question_number}_match_type`;
    const matchType = payload.deep_survey?.[matchTypeKey] || 'complement';
    return (
      <div key={`deep-q-${q.id || q.question_number}`} className="p-6 bg-white rounded-[1.5rem] border border-roseTint/40 shadow-sm">
        <div className="text-base sm:text-lg text-[#1a1a2e] font-bold leading-relaxed mb-4">
          <span className="text-szured/60 font-black mr-2 text-xl">{q.question_number}.</span>
          {q.question_title}
        </div>
        {q.question_stem ? (
          <div className="text-sm sm:text-base text-[#1a1a2e] font-shsans font-semibold mb-4 whitespace-pre-wrap leading-relaxed">
            {q.question_stem}
          </div>
        ) : null}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-lg bg-roseLight text-szured font-black text-xs font-shsans border border-roseTint/35">
                A
              </span>
              <p className="text-sm text-[#4a4a5e] font-shsans whitespace-pre-wrap leading-relaxed flex-1">
                {q.left_option_text}
              </p>
            </div>
          </div>
          <div className="md:text-right">
            <div className="flex items-start gap-2 md:flex-row-reverse">
              <span className="mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-lg bg-roseLight text-szured font-black text-xs font-shsans border border-roseTint/35">
                B
              </span>
              <p className="text-sm text-[#4a4a5e] font-shsans whitespace-pre-wrap md:text-right leading-relaxed flex-1">
                {q.right_option_text}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="max-w-[600px] mx-auto mb-2 flex items-center justify-between text-[11px] text-[#9a9398] font-shsans font-medium select-none">
            <span>A</span>
            <span>B</span>
          </div>
          <div className="max-w-[600px] mx-auto">
            <div className="grid grid-cols-5 gap-2.5">
              {SCALE_5_LR.map((s) => {
                const selected = value === s.leftValue;
                return (
                  <button
                    key={s.leftValue}
                    type="button"
                    onClick={() => updateDeep({ [`q${q.question_number}`]: s.leftValue })}
                    className={`h-12 sm:h-11 rounded-2xl border-2 text-sm font-bold transition ${
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

          {deepModuleIndex === 3 ? (
            <div className="mt-4">
              <div className="inline-flex rounded-full border border-roseTint/35 bg-white/70 overflow-hidden">
                <button
                  type="button"
                  onClick={() => updateDeep({ [matchTypeKey]: 'similar' })}
                  className={`px-4 py-2 text-xs font-shsans font-semibold transition ${
                    matchType === 'similar'
                      ? 'bg-roseLight text-szured'
                      : 'text-[#7a7278] hover:bg-roseLight/40'
                  }`}
                >
                  相似
                </button>
                <button
                  type="button"
                  onClick={() => updateDeep({ [matchTypeKey]: 'complement' })}
                  className={`px-4 py-2 text-xs font-shsans font-semibold transition ${
                    matchType === 'complement'
                      ? 'bg-roseLight text-szured'
                      : 'text-[#7a7278] hover:bg-roseLight/40'
                  }`}
                >
                  互补
                </button>
              </div>
            </div>
          ) : null}
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

      <div className="fixed left-0 right-0 z-40 glass border-b border-roseTint/35 shadow-sm top-[96px] sm:top-[112px]">
        <div className="max-w-4xl mx-auto px-4 py-2.5">
          <div className="flex gap-1 sm:gap-2 justify-between mb-1">
            {STEPS.map((s, idx) => (
              <button
                key={s.key}
                type="button"
                onClick={async () => {
                  navScrollRef.current = true;
                  setDeepModuleIndex(1);
                  skipNextAutosaveRef.current = true;
                  setStep(idx);
                  await persist(payload, idx, false);
                }}
                className={`flex-1 text-center text-xs sm:text-sm py-2.5 rounded-full transition font-shsans font-semibold tracking-wide ${
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
          <p className="text-xs text-[#7a7278] mt-1.5 text-right font-shsans">
            {TXT.progress} {progressPercent}%（{totalProgress.unitIndex}/{totalProgress.totalUnits}）
          </p>

          {/* 深度问卷：模块小进度条与总进度“连在一起” */}
          {step === 1 && deepModules.length > 0 ? (
            <div className="mt-2">
              <div className="h-2.5 bg-rose-100/60 rounded-full overflow-hidden flex gap-0">
                {deepModules.slice(0, 3).map((m, idx) => {
                  const moduleIndex = resolveModuleIndex(m, idx + 1);
                  const p = moduleProgress.get(moduleIndex) || { total: 0, answered: 0 };
                  const pct = p.total > 0 ? p.answered / p.total : 0;
                  const active = moduleIndex === deepModuleIndex;
                  return (
                    <button
                      key={`mod-bar-top-${moduleIndex}`}
                      type="button"
                      onClick={() => {
                        navScrollRef.current = true;
                        setDeepModuleIndex(moduleIndex);
                      }}
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
          ) : null}
        </div>
      </div>

      <div className="h-[128px] sm:h-[144px]" />

      <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="max-w-4xl mx-auto relative z-10">
        {step === 0 ? (
          <section className="bg-cardIvory rounded-3xl border border-roseTint/60 shadow-sm hover:shadow-md transition-shadow p-7 sm:p-10">
            <h2 className="text-2xl font-bold text-[#1a1a2e] mb-8 font-ysong tracking-wide">{TXT.hard}</h2>
            <div className="space-y-8 max-w-xl">
              {effectiveHardItems.map((it) => renderHardQuestion(it))}
            </div>
            <div className="mt-10">
              <button
                type="button"
                disabled={!hardOk || saving}
                onClick={async () => {
                  navScrollRef.current = true;
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

            {currentDeepModule ? (
              <div className="space-y-6">
                <div className="p-5 bg-white/70 border border-roseTint/35 rounded-3xl">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-black text-[#1a1a2e] font-ysong">
                        {deepModuleIndex}. {currentDeepModule.title}
                      </p>
                      
                    </div>
                    <p className="text-xs font-ysong text-slate-500">
                      {(() => {
                        const p = moduleProgress.get(resolveModuleIndex(currentDeepModule, deepModuleIndex)) || { total: 0, answered: 0 };
                        return `\u5df2\u5b8c\u6210${p.answered}/${p.total}\u9898`;
                      })()}
                    </p>
                  </div>
                </div>

                {deepModuleIndex === 3 ? (
                  <p className="text-xs text-[#7a7278] font-shsans leading-relaxed">
                    请您选择每道题目的匹配类型，我们默认互补，鼓励在三观相同的情况下，两个性格不同的灵魂能彼此打开看世界的新视角
                  </p>
                ) : null}

                <div className="space-y-8">
                  {currentDeepModule.questions.map((q) => renderDeepQuestion(q))}
                </div>
              </div>
            ) : null}

            <div className="mt-12 flex gap-4">
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  navScrollRef.current = true;
                  skipNextAutosaveRef.current = true;
                  if (deepModuleIndex > 1) {
                    setDeepModuleIndex((prev) => Math.max(1, prev - 1));
                    await persist(payload, step, false);
                    return;
                  }
                  // module 1 -> go back to hard filter
                  const prevStep = 0;
                  setStep(prevStep);
                  await persist(payload, prevStep, false);
                }}
                className="flex-1 py-4 bg-white border-2 border-roseTint/45 hover:border-roseTint/70 hover:bg-roseLight/35 text-[#4a4a5e] rounded-full font-bold text-lg disabled:opacity-50 transition-all"
              >
                {TXT.prev}
              </button>
              <button
                type="button"
                disabled={!currentDeepModuleComplete || saving}
                onClick={async () => {
                  navScrollRef.current = true;
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
                className="flex-[2] py-4 bg-ctaRose hover:bg-ctaRoseHover text-white rounded-full font-bold text-lg disabled:opacity-50 shadow-[0_8px_24px_rgba(224,154,173,0.32)] transition-all hover:-translate-y-0.5"
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
              {effectiveSettingsItems.map((it) => renderSettingsQuestion(it))}
            </div>
            <div className="mt-12 flex justify-center">
              <button
                type="button"
                disabled={finalizeLoading || !settingsOk || !messageOk}
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

