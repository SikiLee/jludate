import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { Heart, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { getAccessToken } from '../lib/storage';
import {
  createEmptyAnswers,
  FLAT_SURVEY_QUESTIONS,
  SCORE_OPTIONS,
  SURVEY_SECTIONS
} from '../constants/surveyQuestions';
import { COLLEGE_OPTIONS } from '../constants/colleges';
import { CAMPUS_OPTIONS } from '../constants/campuses';
import { GRADE_OPTIONS } from '../constants/grades';
import { useSiteConfig } from '../context/SiteConfigContext';

const GENDER_OPTIONS = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' }
];

const TARGET_GENDER_OPTIONS = [
  { value: 'male', label: '男生' },
  { value: 'female', label: '女生' }
];

function normalizeIncomingAnswers(rawAnswers) {
  const base = createEmptyAnswers();
  if (!rawAnswers || typeof rawAnswers !== 'object') {
    return base;
  }

  const next = { ...base };
  for (const question of FLAT_SURVEY_QUESTIONS) {
    const key = `q${question.number}`;
    const value = rawAnswers[key];
    if (Number.isInteger(value) && value >= 1 && value <= 7) {
      next[key] = value;
    }
  }

  return next;
}

function HeartScale({ value, onChange }) {
  const anchorLabels = {
    1: '非常不认同',
    4: '中立',
    7: '非常认同'
  };

  return (
    <div className="mt-4 px-1">
      <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
        {SCORE_OPTIONS.map((score) => {
          const selected = value === score;
          const warm = score <= 3;
          const neutral = score === 4;

          return (
            <button
              key={score}
              type="button"
              onClick={() => onChange(score)}
              className={[
                'group h-14 sm:h-16 rounded-[1rem] border-2 transition-all duration-300 flex flex-col items-center justify-center relative overflow-hidden',
                selected
                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-105 z-10'
                  : 'border-slate-100 bg-white hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5',
                !selected && warm ? 'text-rose-500 hover:text-rose-600 hover:bg-rose-50/50' : '',
                !selected && neutral ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-50' : '',
                !selected && score >= 5 ? 'text-blue-500 hover:text-blue-600 hover:bg-blue-50/50' : ''
              ].join(' ')}
            >
              {selected && (
                <motion.div
                  layoutId={`heartScaleBg-${score}`}
                  className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-szured opacity-20 pointer-events-none"
                />
              )}
              <Heart
                className={`w-5 h-5 sm:w-6 sm:h-6 mb-1 transition-transform duration-300 ${selected ? 'scale-110 drop-shadow-md' : 'group-hover:scale-110'}`}
                fill="currentColor"
              />
              <span className="text-[10px] sm:text-[12px] font-black tracking-tight">{score}</span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-3 mt-2 text-[10px] sm:text-xs font-semibold text-slate-400">
        {SCORE_OPTIONS.map((score) => (
          <div key={`hint-${score}`} className="text-center min-h-[1.1rem]">
            {anchorLabels[score] || ''}
          </div>
        ))}
      </div>
    </div>
  );
}

function normalizeInterpretation(rawValue) {
  if (!rawValue || typeof rawValue !== 'object') {
    return null;
  }

  return {
    supported: Boolean(rawValue.supported),
    rose_code: rawValue.rose_code || null,
    rose_name: rawValue.rose_name || null,
    summary: rawValue.summary || '',
    markdown: rawValue.markdown || '',
    reason: rawValue.reason || ''
  };
}

function InterpretationPanel({ interpretation }) {
  if (!interpretation) {
    return null;
  }

  if (!interpretation.supported) {
    return (
      <div className="bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl shadow-slate-200/50 rounded-[2rem] p-6 sm:p-8 mb-8 text-center">
        <p className="text-slate-900 font-bold text-lg mb-2">类型深度解析</p>
        <p className="text-slate-500">该类型的专属万字解析目前暂未开放，敬请期待。</p>
      </div>
    );
  }

  const processMarkdown = (md) => {
    if (!md) return '';
    const normalized = md
      .replace(/\r\n/g, '\n')
      .replace(/(^|\n)###([^\s#])/g, '$1### $2');

    const lines = normalized.split('\n');
    const output = [];

    const majorHeadingPattern = /^(什么是.+\?|.+的基本性格|.+在爱情中的特征|.+的理想浪漫|.+的优势和吸引力|.+应注意的要点|与其他人格类型的兼容性|.+建立良好关系|.+的成长建议|结论)$/;

    const isMinorHeading = (line) => {
      if (!line || line.length < 3 || line.length > 22) {
        return false;
      }
      if (/^[*#>-]/.test(line)) {
        return false;
      }
      if (/^(💖|👍|🌀)/.test(line)) {
        return false;
      }
      if (/[。！？!?，,:：；;]/.test(line)) {
        return false;
      }
      return true;
    };

    const pushHeading = (level, text) => {
      if (output.length > 0 && output[output.length - 1] !== '') {
        output.push('');
      }
      output.push(`${level} ${text}`);
      output.push('');
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        if (output.length > 0 && output[output.length - 1] !== '') {
          output.push('');
        }
        continue;
      }

      const boldOnly = line.match(/^\*\*(.+?)\*\*$/);
      if (boldOnly) {
        const title = boldOnly[1].trim();
        if (title) {
          pushHeading('####', title);
          continue;
        }
      }

      if (/^#{1,6}\s+/.test(line)) {
        output.push(line);
        continue;
      }

      if (majorHeadingPattern.test(line)) {
        pushHeading('##', line);
        continue;
      }

      if (isMinorHeading(line)) {
        pushHeading('###', line);
        continue;
      }

      output.push(line);
    }

    return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  const parseBlocks = (md) => {
    const lines = processMarkdown(md).split('\n');
    const blocks = [];
    let currentList = [];

    const flushList = () => {
      if (currentList.length > 0) {
        blocks.push({ type: 'list', items: currentList });
        currentList = [];
      }
    };

    const normalizeInline = (text) => text.replace(/\*\*(.*?)\*\*/g, '$1').trim();

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        flushList();
        continue;
      }

      if (line.startsWith('## ')) {
        flushList();
        blocks.push({ type: 'h2', text: normalizeInline(line.slice(3)) });
        continue;
      }

      if (line.startsWith('### ')) {
        flushList();
        blocks.push({ type: 'h3', text: normalizeInline(line.slice(4)) });
        continue;
      }

      if (line.startsWith('#### ')) {
        flushList();
        blocks.push({ type: 'h4', text: normalizeInline(line.slice(5)) });
        continue;
      }

      const bullet = line.match(/^[-*]\s+(.+)$/);
      if (bullet) {
        currentList.push(normalizeInline(bullet[1]));
        continue;
      }

      flushList();
      blocks.push({ type: 'p', text: normalizeInline(line) });
    }

    flushList();
    return blocks;
  };

  return (
    <div className="bg-white/90 backdrop-blur-2xl border border-white/80 shadow-2xl shadow-indigo-900/10 rounded-[2.5rem] p-8 sm:p-12 mb-12 text-left relative z-10 overflow-hidden">
      {/* Decorative ambient blobs */}
      <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 bg-gradient-to-br from-szured/10 to-transparent rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-32 -mb-32 w-96 h-96 bg-gradient-to-tr from-indigo-500/10 to-transparent rounded-full blur-[80px] pointer-events-none" />

      <div className="text-center mb-10 relative z-10">
        <h3 className="text-slate-900 font-black text-3xl sm:text-4xl tracking-tight mb-4 drop-shadow-sm">
          深度解析报告
        </h3>
        <div className="w-24 h-1.5 bg-gradient-to-r from-szured to-indigo-500 rounded-full mx-auto shadow-sm" />
      </div>
      
      {interpretation.summary && (
        <div className="relative z-10 mb-12 p-8 sm:p-10 bg-gradient-to-br from-indigo-50/40 to-szured/5 rounded-[2rem] border border-white/80 shadow-sm text-center group transition-all duration-300 hover:shadow-md">
          <span className="text-8xl text-indigo-500/10 font-serif absolute -top-4 left-4 sm:left-8 pointer-events-none group-hover:scale-110 transition-transform">"</span>
          <p className="relative z-10 text-slate-700 font-semibold text-lg sm:text-xl leading-8 sm:leading-10 px-2 sm:px-6">
            {interpretation.summary}
          </p>
          <span className="text-8xl text-indigo-500/10 font-serif absolute -bottom-12 right-4 sm:right-8 pointer-events-none group-hover:scale-110 transition-transform">"</span>
        </div>
      )}

      {interpretation.markdown && (
        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="space-y-4">
            {parseBlocks(interpretation.markdown).map((block, index) => {
              if (block.type === 'h2') {
                return (
                  <div key={`h2-${index}`} className="mt-14 mb-8">
                    <div className="flex items-center gap-4 mb-1">
                      <span className="w-1.5 sm:w-2 h-8 sm:h-10 bg-gradient-to-b from-szured to-indigo-500 rounded-full inline-block shadow-sm" />
                      <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                        {block.text}
                      </h2>
                    </div>
                  </div>
                );
              }

              if (block.type === 'h3') {
                return (
                  <h3
                    key={`h3-${index}`}
                    className="text-xl sm:text-2xl font-black tracking-tight text-indigo-900 mt-10 mb-5 flex items-center gap-3"
                  >
                    <span className="text-szured/80 text-lg">✦</span>
                    {block.text}
                  </h3>
                );
              }

              if (block.type === 'h4') {
                return (
                  <h4
                    key={`h4-${index}`}
                    className="text-lg sm:text-xl font-bold tracking-tight text-slate-800 mt-8 mb-4 border-l-4 border-slate-200 pl-4"
                  >
                    {block.text}
                  </h4>
                );
              }

              if (block.type === 'list') {
                return (
                  <ul key={`list-${index}`} className="my-6 space-y-4 text-slate-700 bg-slate-50/50 rounded-2xl p-6 sm:p-8 border border-slate-100/50">
                    {block.items.map((item, itemIndex) => (
                      <li key={`li-${index}-${itemIndex}`} className="flex items-start gap-4">
                        <span className="w-2 h-2 rounded-full bg-gradient-to-r from-szured to-indigo-400 mt-2.5 flex-shrink-0 shadow-sm" />
                        <span className="text-base sm:text-lg leading-loose font-medium text-slate-600 block">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                );
              }

              return (
                <p key={`p-${index}`} className="text-[1.05rem] sm:text-[1.15rem] leading-[2.1] text-slate-600 mb-6 font-medium tracking-[0.015em]">
                  {block.text}
                </p>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RoseSurveyLegacy() {
  const isLoggedIn = Boolean(getAccessToken());
  const location = useLocation();
  const { siteConfig } = useSiteConfig();
  const [answers, setAnswers] = useState(createEmptyAnswers);
  const [surveySections, setSurveySections] = useState(SURVEY_SECTIONS);
  const [profile, setProfile] = useState({
    nickname: '',
    gender: '',
    target_gender: '',
    campus: '',
    college: '',
    grade: '',
    message_to_partner: '',
    share_contact_with_match: false,
    match_contact_detail: '',
    allow_cross_school_match: false,
    completed: !isLoggedIn
  });
  const [currentStep, setCurrentStep] = useState(isLoggedIn ? 0 : 1);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [submittedRose, setSubmittedRose] = useState(null);
  const [surveyCompleted, setSurveyCompleted] = useState(false);
  const navigate = useNavigate();
  const startInTestMode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const mode = (params.get('mode') || '').trim().toLowerCase();
    return mode === 'test' || mode === 'testing' || params.get('start') === '1';
  }, [location.search]);

  useEffect(() => {
    const profilePromise = isLoggedIn
      ? api.get('/profile', { skipAuthRedirect: true }).catch(() => ({
        data: {
          data: {
            nickname: '',
            gender: '',
            target_gender: '',
            campus: '',
            college: '',
            grade: '',
            message_to_partner: '',
            share_contact_with_match: false,
            match_contact_detail: '',
            allow_cross_school_match: false,
            completed: false
          }
        }
      }))
      : Promise.resolve({
        data: {
          data: {
            nickname: '',
            gender: '',
            target_gender: '',
            campus: '',
            college: '',
            grade: '',
            message_to_partner: '',
            share_contact_with_match: false,
            match_contact_detail: '',
            allow_cross_school_match: false,
            completed: false
          }
        }
      });

    const surveyPromise = isLoggedIn
      ? api.get('/survey/get', { skipAuthRedirect: true }).catch(() => ({ data: { data: { completed: false, answers: null, rose_code: null, rose_name: null } } }))
      : Promise.resolve({ data: { data: { completed: false, answers: null, rose_code: null, rose_name: null } } });

    Promise.all([
      profilePromise,
      surveyPromise,
      api.get('/survey/questions', { skipAuthRedirect: true }).catch(() => ({ data: { data: { sections: SURVEY_SECTIONS } } }))
    ])
      .then(([profileRes, surveyRes, questionsRes]) => {
        const profilePayload = profileRes.data?.data || {};
        const surveyPayload = surveyRes.data?.data || {};
        const sectionPayload = questionsRes.data?.data?.sections;

        if (Array.isArray(sectionPayload) && sectionPayload.length > 0) {
          setSurveySections(sectionPayload);
        } else {
          setSurveySections(SURVEY_SECTIONS);
        }

        setProfile({
          nickname: typeof profilePayload.nickname === 'string' ? profilePayload.nickname : '',
          gender: profilePayload.gender || '',
          target_gender: profilePayload.target_gender || '',
          campus: typeof profilePayload.campus === 'string' ? profilePayload.campus : '',
          college: typeof profilePayload.college === 'string' ? profilePayload.college : '',
          grade: typeof profilePayload.grade === 'string' ? profilePayload.grade : '',
          message_to_partner: typeof profilePayload.message_to_partner === 'string' ? profilePayload.message_to_partner : '',
          share_contact_with_match: Boolean(profilePayload.share_contact_with_match),
          match_contact_detail: typeof profilePayload.match_contact_detail === 'string' ? profilePayload.match_contact_detail : '',
          allow_cross_school_match: Boolean(profilePayload.allow_cross_school_match),
          completed: isLoggedIn ? Boolean(profilePayload.completed) : true
        });

        setAnswers(normalizeIncomingAnswers(surveyPayload.answers));
        setSurveyCompleted(Boolean(surveyPayload.completed));

        if (surveyPayload.completed && surveyPayload.rose_code) {
          setSubmittedRose({
            rose_code: surveyPayload.rose_code,
            rose_name: surveyPayload.rose_name || '',
            type_interpretation: normalizeInterpretation(surveyPayload.type_interpretation)
          });
        }

        if (!isLoggedIn) {
          setCurrentStep(1);
        } else if (profilePayload.completed) {
          setCurrentStep(1);
        }
      })
      .finally(() => setInitLoading(false));
  }, [isLoggedIn]);

  const answeredCount = useMemo(
    () => Object.values(answers).filter((value) => Number.isInteger(value)).length,
    [answers]
  );

  const totalSteps = surveySections.length + (isLoggedIn ? 1 : 0);
  const totalStepsSafe = Math.max(1, totalSteps);
  const displayStep = isLoggedIn ? currentStep + 1 : currentStep;
  const progressBaseStep = isLoggedIn ? currentStep : Math.max(0, currentStep - 1);
  const stepProgress = Math.round((progressBaseStep / totalStepsSafe) * 100);
  const currentSection = currentStep > 0 ? surveySections[currentStep - 1] : null;

  const sectionCompletedCount = useMemo(() => {
    if (!currentSection) {
      return 0;
    }

    return currentSection.questions.filter((question) => Number.isInteger(answers[`q${question.number}`])).length;
  }, [currentSection, answers]);

  const isCurrentSectionComplete = useMemo(() => {
    if (!currentSection) {
      return false;
    }

    return currentSection.questions.every((question) => Number.isInteger(answers[`q${question.number}`]));
  }, [currentSection, answers]);

  const handleScoreChange = (questionNumber, score) => {
    setAnswers((prev) => ({
      ...prev,
      [`q${questionNumber}`]: score
    }));
  };

  const handleSaveProfile = async () => {
    const nick = typeof profile.nickname === 'string' ? profile.nickname.trim() : '';
    if (nick && [...nick].length > 20) {
      toast.error('昵称不能超过20字');
      return false;
    }
    if (!profile.campus || !CAMPUS_OPTIONS.includes(profile.campus)) {
      toast.error('请选择所在校区');
      return false;
    }
    if (!profile.college || !COLLEGE_OPTIONS.includes(profile.college)) {
      toast.error('请选择所在学院');
      return false;
    }
    if (!profile.grade || !GRADE_OPTIONS.includes(profile.grade)) {
      toast.error('请选择年级');
      return false;
    }
    if (!profile.gender || !profile.target_gender) {
      toast.error('请选择匹配性别');
      return false;
    }
    const msg = typeof profile.message_to_partner === 'string' ? profile.message_to_partner : '';
    if ([...msg].length > 300) {
      toast.error('想说的话不能超过300字');
      return false;
    }

    const shareContact = Boolean(profile.share_contact_with_match);
    const contactDetail = typeof profile.match_contact_detail === 'string' ? profile.match_contact_detail.trim() : '';
    if (shareContact) {
      if (!contactDetail || [...contactDetail].length > 20) {
        toast.error('选择展示联系方式时，请填写联系方式（1～20字）');
        return false;
      }
    }

    await api.post('/profile', {
      nickname: nick,
      gender: profile.gender,
      target_gender: profile.target_gender,
      campus: profile.campus,
      college: profile.college,
      grade: profile.grade,
      message_to_partner: msg,
      share_contact_with_match: shareContact,
      match_contact_detail: shareContact ? contactDetail : '',
      allow_cross_school_match: Boolean(profile.allow_cross_school_match)
    });

    setProfile((prev) => ({ ...prev, completed: true }));
    return true;
  };

  const handleNextStep = async () => {
    if (isLoggedIn && currentStep === 0) {
      setLoading(true);
      try {
        const ok = await handleSaveProfile();
        if (ok) {
          setCurrentStep(1);
          toast.success('基础信息已保存');
        }
      } catch {
        // handled by interceptor
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!isCurrentSectionComplete) {
      toast.error('请先完成当前部分所有题目');
      return;
    }

    if (currentStep < surveySections.length) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePreviousStep = () => {
    const minStep = isLoggedIn ? 0 : 1;
    if (currentStep > minStep) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!isCurrentSectionComplete) {
      toast.error('请先完成当前部分所有题目');
      return;
    }

    if (answeredCount < 50) {
      toast.error(`还有 ${50 - answeredCount} 题未作答`);
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/survey/submit', { answers });
      const roseCode = res.data?.data?.rose_code;
      const roseName = res.data?.data?.rose_name;
      const interpretation = normalizeInterpretation(res.data?.data?.type_interpretation);

      setSubmittedRose({
        rose_code: roseCode || '--',
        rose_name: roseName || '',
        type_interpretation: interpretation
      });

      toast.success(isLoggedIn ? '问卷已提交，已生成你的 ROSE 类型' : '类型测试完成，登录后可参与匹配');
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  if (initLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-szured" />
      </div>
    );
  }

  if (submittedRose) {
    return (
      <div className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6 flex flex-col items-center relative overflow-hidden">
        {/* Ambient Aesthetic Background */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] bg-szured/10 rounded-full blur-[120px] pointer-events-none" />

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-4xl z-10"
        >
          {/* Header Typography */}
          <div className="text-center mb-12 mt-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-block px-4 py-1.5 rounded-full bg-white/80 border border-slate-200/60 shadow-sm mb-5 backdrop-blur-sm"
            >
              <span className="text-xs sm:text-sm font-bold bg-gradient-to-r from-szured to-indigo-600 bg-clip-text text-transparent">
                {isLoggedIn ? '🎉 分析完成，您已进入优质匹配池' : '🎉 分析完成，您已解锁专属类型报告'}
              </span>
            </motion.div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4 tracking-tight">
              遇 见 真 实 的 自 己
            </h2>
            <p className="text-slate-500 font-medium text-base sm:text-lg">
              {isLoggedIn ? '系统已为您生成专属的沉浸式心理测试解读报告' : '您已完成游客测试，登录后即可参与每周匹配'}
            </p>
          </div>

          {/* Persona Card */}
          <div className="bg-white/80 backdrop-blur-2xl border border-white/60 rounded-[2rem] p-7 sm:p-10 mb-9 shadow-2xl shadow-indigo-900/5 text-center relative overflow-hidden group">
            {/* Soft inner glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/60 to-transparent pointer-events-none" />
            
            <p className="relative z-10 text-szured/90 font-black text-xs sm:text-sm tracking-[0.28em] mb-4 uppercase">YOUR PERSONA TYPE</p>
            <h1 className="relative z-10 text-5xl sm:text-7xl font-black text-slate-900 mb-5 tracking-tight drop-shadow-sm group-hover:scale-105 transition-transform duration-700">
              {submittedRose.rose_code}
            </h1>
            <div className="relative z-10 inline-flex items-center justify-center px-6 py-2.5 sm:px-8 sm:py-3 bg-slate-900 text-white rounded-full shadow-xl shadow-slate-900/20">
              <span className="font-bold text-lg sm:text-xl tracking-wide">{submittedRose.rose_name}</span>
            </div>
          </div>

          {/* Next Step CTA */}
          <motion.div
             initial={{ y: 20, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             transition={{ delay: 0.3 }}
             className="mb-14 flex flex-col sm:flex-row justify-center gap-3"
          >
             <button
              onClick={() => navigate(isLoggedIn ? '/match' : '/auth')}
              className="px-8 py-4 sm:px-10 sm:py-5 bg-slate-900 hover:bg-black hover:-translate-y-1 active:scale-95 text-white rounded-2xl font-black text-base sm:text-lg transition-all duration-300 shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2"
            >
              {isLoggedIn ? '开启心动匹配之旅' : '登录后开启匹配'}
              <span className="text-2xl leading-none">→</span>
            </button>
            <button
              onClick={() => navigate(`/feedback?from=survey_result${submittedRose.rose_code ? `&rose=${encodeURIComponent(submittedRose.rose_code)}` : ''}`)}
              className="px-8 py-4 sm:px-10 sm:py-5 bg-white border border-slate-200 hover:border-slate-300 hover:-translate-y-1 text-slate-700 rounded-2xl font-bold text-base sm:text-lg transition-all duration-300 flex items-center justify-center"
            >
              提交使用反馈
            </button>
            {isLoggedIn ? (
              <button
                onClick={() => {
                  setSubmittedRose(null);
                  setCurrentStep(profile.completed ? 1 : 0);
                }}
                className="px-8 py-4 sm:px-10 sm:py-5 bg-white border border-indigo-200 hover:border-indigo-300 hover:-translate-y-1 text-indigo-700 rounded-2xl font-bold text-base sm:text-lg transition-all duration-300 flex items-center justify-center"
              >
                重新修改问卷
              </button>
            ) : null}
          </motion.div>

          <InterpretationPanel
            interpretation={submittedRose.type_interpretation}
          />
        </motion.div>
      </div>
    );
  }

  if (!surveyCompleted && !startInTestMode) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-[2rem] p-8 max-w-xl w-full shadow-2xl shadow-slate-200 text-center border border-slate-100">
          <h2 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">未填写问卷</h2>
          <p className="text-slate-500 mb-8">完成问卷后才能查看类型与匹配结果。</p>
          <button
            type="button"
            onClick={() => navigate('/survey/questionnaire?mode=test')}
            className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-black transition"
          >
            去测试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-8 px-3 sm:px-6 relative overflow-hidden">
      {/* Ambient glassmorphism background */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-szured/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-4xl mx-auto relative z-10"
      >
        <div className="bg-white/80 backdrop-blur-2xl border border-white/60 shadow-xl shadow-indigo-900/5 rounded-[2rem] p-7 sm:p-10 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-szured/10 to-transparent rounded-bl-full pointer-events-none" />
          
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-2 tracking-tight">
            ROSE 深度测试
          </h2>
          <p className="text-slate-500 font-medium text-sm sm:text-base mb-8">
            寻找最真实的内心世界 <span className="mx-2 text-slate-300">|</span> 步骤 {displayStep}/{totalSteps}
          </p>

          <div className="w-full h-2.5 sm:h-3.5 bg-slate-100 rounded-full overflow-hidden shadow-inner relative">
            <motion.div 
              className="h-full bg-gradient-to-r from-szured to-indigo-500 rounded-full relative" 
              initial={{ width: 0 }}
              animate={{ width: `${stepProgress}%` }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            >
              <div className="absolute inset-0 bg-white/20 w-full h-full" />
            </motion.div>
          </div>

          <div className="flex justify-between items-center text-xs sm:text-sm font-semibold text-slate-400 mt-3">
            <span className="text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">总进度 {stepProgress}%</span>
            <span className="text-szured bg-szured/5 px-3 py-1 rounded-full">{answeredCount} / 50 题</span>
          </div>

          {currentSection && (
            <div className="mt-5 inline-block text-xs sm:text-sm font-medium text-slate-500 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
              当前部分完成度：<span className="text-slate-900 font-bold">{sectionCompletedCount}</span> / {currentSection.questions.length}
            </div>
          )}

        </div>

        {isLoggedIn && currentStep === 0 ? (
          <motion.section 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-xl shadow-slate-200/40 p-7 sm:p-10"
          >
            <div className="flex items-center gap-4 mb-3">
              <span className="flex items-center justify-center min-w-[2.5rem] h-10 rounded-full bg-szured/10 text-szured font-black text-lg">0</span>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">基础信息</h3>
            </div>
            <p className="text-slate-500 mb-8 font-medium ml-12 sm:ml-14">基础信息可以重复修改，匹配成功后将向对方展示。</p>

            <div className="space-y-6 ml-0 sm:ml-14 max-w-xl">
              <div className="group">
                <label className="block text-sm font-bold text-slate-700 mb-3 ml-1 transition-colors">昵称</label>
                <input
                  type="text"
                  value={profile.nickname}
                  onChange={(e) => setProfile((prev) => ({ ...prev, nickname: e.target.value }))}
                  maxLength={20}
                  placeholder="没有想好可以不填哦"
                  className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-slate-100 hover:border-slate-200 focus:bg-white focus:ring-4 focus:ring-szured/10 focus:border-szured outline-none transition-all shadow-sm font-medium text-slate-800"
                />
                <p className="mt-1.5 text-xs text-slate-500">已输入 {[...profile.nickname].length}/20 字（可不填）</p>
              </div>

              <div className="group">
                <label className="block text-sm font-bold text-slate-700 mb-3 ml-1 transition-colors">所在校区</label>
                <div className="relative">
                  <select
                    value={profile.campus}
                    onChange={(e) => setProfile((prev) => ({ ...prev, campus: e.target.value }))}
                    className="w-full px-5 py-4 appearance-none rounded-2xl bg-white border-2 border-slate-100 hover:border-slate-200 focus:bg-white focus:ring-4 focus:ring-szured/10 focus:border-szured outline-none transition-all shadow-sm font-medium text-slate-800"
                  >
                    <option value="" disabled>请选择校区...</option>
                    {CAMPUS_OPTIONS.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              {Boolean(siteConfig.cross_school_matching_enabled) ? (
                <div className="group">
                  <label className="block text-sm font-bold text-slate-700 mb-3 ml-1 transition-colors">是否允许跨校区匹配</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setProfile((prev) => ({ ...prev, allow_cross_school_match: false }))}
                      className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                        profile.allow_cross_school_match
                          ? 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          : 'border-violet-300 bg-violet-50 text-violet-700'
                      }`}
                    >
                      否，仅本校区内匹配
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfile((prev) => ({ ...prev, allow_cross_school_match: true }))}
                      className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                        profile.allow_cross_school_match
                          ? 'border-violet-300 bg-violet-50 text-violet-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      是，可参与跨校区匹配
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">仅在管理员开启「跨校区匹配」后生效；系统按校园邮箱域名区分是否同校区范围。</p>
                </div>
              ) : null}

              <div className="group">
                <label className="block text-sm font-bold text-slate-700 mb-3 ml-1 transition-colors">所在学院</label>
                <div className="relative">
                  <select
                    value={profile.college}
                    onChange={(e) => setProfile((prev) => ({ ...prev, college: e.target.value }))}
                    className="w-full px-5 py-4 appearance-none rounded-2xl bg-white border-2 border-slate-100 hover:border-slate-200 focus:bg-white focus:ring-4 focus:ring-szured/10 focus:border-szured outline-none transition-all shadow-sm font-medium text-slate-800 text-sm"
                  >
                    <option value="" disabled>请选择学院...</option>
                    {COLLEGE_OPTIONS.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-bold text-slate-700 mb-3 ml-1 transition-colors">年级</label>
                <div className="relative">
                  <select
                    value={profile.grade}
                    onChange={(e) => setProfile((prev) => ({ ...prev, grade: e.target.value }))}
                    className="w-full px-5 py-4 appearance-none rounded-2xl bg-white border-2 border-slate-100 hover:border-slate-200 focus:bg-white focus:ring-4 focus:ring-szured/10 focus:border-szured outline-none transition-all shadow-sm font-medium text-slate-800"
                  >
                    <option value="" disabled>请选择年级...</option>
                    {GRADE_OPTIONS.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-bold text-slate-700 mb-3 ml-1 transition-colors">我的性别</label>
                <div className="relative">
                  <select
                    value={profile.gender}
                    onChange={(e) => setProfile((prev) => ({ ...prev, gender: e.target.value }))}
                    className="w-full px-5 py-4 appearance-none rounded-2xl bg-white border-2 border-slate-100 hover:border-slate-200 focus:bg-white focus:ring-4 focus:ring-szured/10 focus:border-szured outline-none transition-all shadow-sm font-medium text-slate-800"
                  >
                    <option value="" disabled>请选择...</option>
                    {GENDER_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-bold text-slate-700 mb-3 ml-1 transition-colors">对象性别</label>
                <div className="relative">
                  <select
                    value={profile.target_gender}
                    onChange={(e) => setProfile((prev) => ({ ...prev, target_gender: e.target.value }))}
                    className="w-full px-5 py-4 appearance-none rounded-2xl bg-white border-2 border-slate-100 hover:border-slate-200 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm font-medium text-slate-800"
                  >
                    <option value="" disabled>请选择...</option>
                    {TARGET_GENDER_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-bold text-slate-700 mb-3 ml-1 transition-colors">对对方想说的话</label>
                <textarea
                  value={profile.message_to_partner}
                  onChange={(e) => setProfile((prev) => ({ ...prev, message_to_partner: e.target.value }))}
                  rows={4}
                  maxLength={300}
                  placeholder="仅匹配上的对方可见。自我介绍或打招呼都可以；没有想说的话也可以不填哦。"
                  className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-slate-100 hover:border-slate-200 focus:bg-white focus:ring-4 focus:ring-szured/10 focus:border-szured outline-none transition-all shadow-sm font-medium text-slate-800 text-sm resize-y min-h-[100px]"
                />
                <p className="mt-1.5 text-xs text-slate-500">已输入 {[...profile.message_to_partner].length}/300 字（可不填）</p>
              </div>

              <div className="group">
                <label className="block text-sm font-bold text-slate-700 mb-3 ml-1 transition-colors">匹配成功后，是否向对方展示自己的联系方式</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setProfile((prev) => ({ ...prev, share_contact_with_match: false, match_contact_detail: '' }))}
                    className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                      profile.share_contact_with_match
                        ? 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        : 'border-violet-300 bg-violet-50 text-violet-700'
                    }`}
                  >
                    否
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfile((prev) => ({ ...prev, share_contact_with_match: true }))}
                    className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                      profile.share_contact_with_match
                        ? 'border-violet-300 bg-violet-50 text-violet-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    是
                  </button>
                </div>
                {profile.share_contact_with_match ? (
                  <div className="mt-4">
                    <label className="block text-xs font-semibold text-slate-500 mb-2 ml-1">联系方式（将展示给对方，必填，1～20 字）</label>
                    <input
                      type="text"
                      value={profile.match_contact_detail}
                      onChange={(e) => setProfile((prev) => ({ ...prev, match_contact_detail: e.target.value }))}
                      maxLength={20}
                      placeholder="如微信号、QQ 等"
                      className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-slate-100 hover:border-slate-200 focus:bg-white focus:ring-4 focus:ring-szured/10 focus:border-szured outline-none transition-all shadow-sm font-medium text-slate-800"
                    />
                    <p className="mt-1.5 text-xs text-slate-500">已输入 {[...profile.match_contact_detail].length}/20 字</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-10 ml-0 sm:ml-14 max-w-xl">
              <button
                type="button"
                onClick={handleNextStep}
                disabled={loading}
                className="w-full py-4 bg-slate-900 hover:bg-black hover:-translate-y-1 text-white rounded-2xl font-black text-lg transition-all duration-300 shadow-xl shadow-slate-900/20 disabled:opacity-60 disabled:hover:translate-y-0 flex justify-center items-center gap-2"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : '保存并开启问卷'}
                {!loading && <span className="text-xl leading-none">→</span>}
              </button>
            </div>
          </motion.section>
        ) : (
          <motion.section 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            key={`section-${currentStep}`}
            className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-xl shadow-slate-200/40 p-6 sm:p-10"
          >
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-100/80">
              <span className="flex items-center justify-center min-w-[3rem] h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 font-black text-xl">
                {currentStep}
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{currentSection.title}</h3>
            </div>
            
            <div className="space-y-10">
              {currentSection.questions.map((question, idx) => {
                const key = `q${question.number}`;
                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={question.number} 
                    className="p-6 sm:p-8 bg-white rounded-[1.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300"
                  >
                    <div className="text-base sm:text-lg text-slate-800 font-bold leading-relaxed mb-6">
                      <span className="text-szured/60 font-black mr-2 text-xl">{question.number}.</span> 
                      {question.text}
                    </div>
                    <HeartScale
                      value={answers[key]}
                      onChange={(score) => handleScoreChange(question.number, score)}
                    />
                  </motion.div>
                );
              })}
            </div>

            <div className="flex gap-4 mt-12 pt-8 border-t border-slate-100/80">
              <button
                type="button"
                onClick={handlePreviousStep}
                disabled={loading}
                className="flex-[1] py-4 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-2xl font-bold text-base sm:text-lg transition-all duration-300 disabled:opacity-60 flex justify-center items-center gap-2"
              >
                <span className="text-xl leading-none">←</span>
                上一步
              </button>

              {currentStep < surveySections.length ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={loading}
                  className="flex-[2] py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-base sm:text-lg transition-all duration-300 shadow-xl shadow-slate-900/20 hover:-translate-y-1 disabled:opacity-60 disabled:hover:translate-y-0 flex justify-center items-center gap-2"
                >
                  下一部分
                  <span className="text-xl leading-none">→</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-[2] py-4 bg-gradient-to-r from-szured to-indigo-600 hover:from-szured/90 hover:to-indigo-600/90 text-white rounded-2xl font-black text-base sm:text-lg transition-all duration-300 shadow-xl shadow-szured/30 hover:-translate-y-1 disabled:opacity-60 disabled:hover:translate-y-0 flex justify-center items-center gap-2 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-white/20 w-0 group-hover:w-full transition-all duration-500 ease-out" />
                  <span className="relative z-10 flex items-center gap-2">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : '生成专属类型解析'}
                    {!loading && <span className="text-xl leading-none">✨</span>}
                  </span>
                </button>
              )}
            </div>
          </motion.section>
        )}
      </motion.div>
    </div>
  );
}

export default RoseSurveyLegacy;
