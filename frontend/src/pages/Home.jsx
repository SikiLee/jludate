import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Clock, ShieldCheck, Target, ChevronDown } from 'lucide-react';
import { useSiteConfig } from '../context/SiteConfigContext';
import { getAccessToken } from '../lib/storage';

const SakuraPetalsOverlay = React.memo(function SakuraPetalsOverlay({ baseCount = 36, containerClass = 'pointer-events-none fixed inset-0 z-0 overflow-hidden' }) {
  const isReduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const initialCount = useMemo(() => {
    const viewportIsSmall = typeof window !== 'undefined' && window.innerWidth < 640;
    return isReduced ? 0 : (viewportIsSmall ? Math.floor(baseCount * 0.5) : baseCount);
  }, []); // 仅在挂载时计算一次，避免随父组件重渲染而重建

  const petals = useMemo(() => Array.from({ length: initialCount }).map((_, index) => {
    // 分段均匀分布：把 0-100 划分为 initialCount 份，每份内做微小抖动，避免扎堆
    const segment = 100 / Math.max(1, initialCount);
    const segmentStart = index * segment;
    const jitter = (Math.random() * 0.8 + 0.1) * segment; // 10%-90% 的段内抖动
    const left = Math.min(99.5, segmentStart + jitter);
    const size = 10 + Math.random() * 18; // 10-28px
    // 加快速度：缩短每片花瓣的下落持续时间
    const duration = 6 + Math.random() * 9; // 6-15s
    // 让挂载后立刻“飘满全屏”：用负延迟覆盖完整 duration，让每片在不同阶段出现
    const delay = Math.random() * duration;
    const opacity = 0.3 + Math.random() * 0.4; // 0.3-0.7（减少重绘）
    const rotate = Math.random() * 360;
    const sway = Math.random() < 0.5 ? -1 : 1;
    return (
      <svg
        key={`petal-${index}`}
        viewBox="0 0 32 32"
        style={{
          left: `${left}%`,
          width: `${size}px`,
          height: `${size * 1.2}px`,
          animationDuration: `${duration}s`,
          animationDelay: `${-delay}s`,
          opacity,
          transform: `rotate(${rotate}deg)`,
          ['--sway-dir']: sway,
          willChange: 'transform'
        }}
        className="absolute -top-10 animate-[sakura-fall_linear_infinite] text-roseTint/80 select-none"
      >
        <path
          d="M16 2 C12 6, 10 10, 10 14 C10 18, 13 22, 16 30 C19 22, 22 18, 22 14 C22 10, 20 6, 16 2 Z"
          fill="currentColor"
        />
      </svg>
    );
  }), []); // 花瓣元素只生成一次

  return isReduced ? null : (
    <>
      <style>{`
        @keyframes sakura-fall {
          0%   { transform: translate3d(0, -10vh, 0) rotate(0deg) }
          25%  { transform: translate3d(calc(var(--sway-dir, 1) * -10px), 25vh, 0) rotate(90deg) }
          50%  { transform: translate3d(calc(var(--sway-dir, 1) *  10px), 50vh, 0) rotate(180deg) }
          75%  { transform: translate3d(calc(var(--sway-dir, 1) * -10px), 75vh, 0) rotate(270deg) }
          100% { transform: translate3d(calc(var(--sway-dir, 1) *  10px), 110vh, 0) rotate(360deg) }
        }
      `}</style>
      <div className={containerClass}>
        {petals}
      </div>
    </>
  );
});

function Home() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);
  const { siteConfig } = useSiteConfig();
  const [metrics, setMetrics] = useState({
    registered_users: null,
    survey_completion_rate: null,
    matched_users: null,
    metric_visibility: {
      registered_users: true,
      survey_completion_rate: true,
      matched_users: true
    }
  });
  const [countdownDeadlineMs, setCountdownDeadlineMs] = useState(null);
  const brandName = siteConfig.brand_name || '配吉友';
  const allowedDomains = Array.isArray(siteConfig.allowed_email_domains) && siteConfig.allowed_email_domains.length > 0
    ? siteConfig.allowed_email_domains
    : ['mails.jlu.edu.cn'];
  const domainText = allowedDomains.map((item) => `@${item}`).join(' / ');
  const homeHeroBackgroundUrl = siteConfig.home_hero_background_url;
  /** 默认首屏杏花图：放到 frontend/public/hero-blossoms.png；后台「首页背景」可覆盖 */
  const defaultHeroPhoto = '/hero-blossoms.png';
  const heroPhotoSrc =
    typeof homeHeroBackgroundUrl === 'string' && homeHeroBackgroundUrl.trim()
      ? homeHeroBackgroundUrl.trim()
      : defaultHeroPhoto;
  const isLoggedIn = Boolean(getAccessToken());

  const joinTarget = '/auth';
  const joinLabel = '立即加入';
  const matchSchedule = siteConfig.match_schedule && typeof siteConfig.match_schedule === 'object'
    ? siteConfig.match_schedule
    : { day_of_week: 5, hour: 20, minute: 0 };
  const scheduleDay = Number.isInteger(matchSchedule.day_of_week) ? matchSchedule.day_of_week : 5;
  const scheduleHour = Number.isInteger(matchSchedule.hour) ? matchSchedule.hour : 20;
  const scheduleMinute = Number.isInteger(matchSchedule.minute) ? matchSchedule.minute : 0;
  const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekdayLabel = weekdayNames[scheduleDay] || '周二';
  const scheduleTimeLabel = `${String(scheduleHour).padStart(2, '0')}:${String(scheduleMinute).padStart(2, '0')}`;
  const scheduleRevealLabel = `${weekdayLabel} ${scheduleTimeLabel}`;

  /** 页脚金色：香槟金偏灰，与 footerPink 更融；主标题略饱和，下两行更淡、阴影更轻 */
  const footerGoldMainStyle = {
    background: 'linear-gradient(168deg, #ebe3d6 0%, #c4a06a 40%, #8d7348 75%, #5a4633 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    filter: 'drop-shadow(0 0.5px 0 rgba(255,255,255,0.22)) drop-shadow(0 1px 2px rgba(45, 36, 24, 0.12))'
  };
  const footerGoldSoftStyle = {
    background: 'linear-gradient(168deg, #ddd5cb 0%, #a8926a 52%, #6e5c44 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    filter: 'drop-shadow(0 0.5px 0 rgba(255,255,255,0.18))'
  };

  // Countdown timer logic (configured weekly schedule)
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const timer = setInterval(() => {
      let diff = 0;
      if (Number.isFinite(countdownDeadlineMs) && countdownDeadlineMs > 0) {
        diff = Math.max(0, countdownDeadlineMs - Date.now());
      } else {
        const now = new Date();
        const nextSchedule = new Date(now);
        const daysUntil = (scheduleDay - now.getDay() + 7) % 7;
        nextSchedule.setDate(now.getDate() + daysUntil);
        nextSchedule.setHours(scheduleHour, scheduleMinute, 0, 0);
        if (daysUntil === 0 && now >= nextSchedule) {
          nextSchedule.setDate(nextSchedule.getDate() + 7);
        }
        diff = Math.max(0, nextSchedule - now);
      }

      if (diff > 0) {
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / 1000 / 60) % 60),
          seconds: Math.floor((diff / 1000) % 60)
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [countdownDeadlineMs, scheduleDay, scheduleHour, scheduleMinute]);

  useEffect(() => {
    let cancelled = false;

    async function loadHomeMetrics() {
      try {
        const response = await fetch('/api/public/home-metrics', { cache: 'no-store' });
        const payload = await response.json();

        if (cancelled || !response.ok || payload?.code !== 200) {
          return;
        }

        const data = payload?.data || {};
        const metricVisibilityRaw = data.metric_visibility && typeof data.metric_visibility === 'object'
          ? data.metric_visibility
          : {};
        const metricVisibility = {
          registered_users: typeof metricVisibilityRaw.registered_users === 'boolean' ? metricVisibilityRaw.registered_users : true,
          survey_completion_rate: typeof metricVisibilityRaw.survey_completion_rate === 'boolean' ? metricVisibilityRaw.survey_completion_rate : true,
          matched_users: typeof metricVisibilityRaw.matched_users === 'boolean' ? metricVisibilityRaw.matched_users : true
        };
        setMetrics({
          registered_users: metricVisibility.registered_users && Number.isFinite(data.registered_users) ? data.registered_users : null,
          survey_completion_rate: metricVisibility.survey_completion_rate && Number.isFinite(data.survey_completion_rate)
            ? data.survey_completion_rate
            : null,
          matched_users: metricVisibility.matched_users && Number.isFinite(data.matched_users) ? data.matched_users : null,
          metric_visibility: metricVisibility
        });

        if (Number.isFinite(data.next_match_in_seconds) && data.next_match_in_seconds >= 0) {
          setCountdownDeadlineMs(Date.now() + data.next_match_in_seconds * 1000);
        }
      } catch {
        // keep fallback placeholders
      }
    }

    loadHomeMetrics();
    return () => {
      cancelled = true;
    };
  }, []);

  const numberFormatter = new Intl.NumberFormat('zh-CN');
  const registeredUsersText = metrics.registered_users === null
    ? '--'
    : numberFormatter.format(metrics.registered_users);
  const completionRateText = metrics.survey_completion_rate === null
    ? '--'
    : `${metrics.survey_completion_rate}%`;
  const matchedUsersText = metrics.matched_users === null
    ? '--'
    : numberFormatter.format(metrics.matched_users);
  const showRegisteredUsersMetric = Boolean(metrics.metric_visibility?.registered_users);
  const showCompletionRateMetric = Boolean(metrics.metric_visibility?.survey_completion_rate);
  const showMatchedUsersMetric = Boolean(metrics.metric_visibility?.matched_users);
  const showAnyMetric = showRegisteredUsersMetric || showCompletionRateMetric || showMatchedUsersMetric;

  const applySiteTokens = (text) => {
    if (typeof text !== 'string') {
      return '';
    }
    return text
      .replace(/\{XXDate\}/g, brandName)
      .replace(/\{BRAND_NAME\}/g, brandName)
      .replace(/\{ALLOWED_DOMAINS\}/g, domainText);
  };

  const faqs = Array.isArray(siteConfig.faq_items) && siteConfig.faq_items.length > 0
    ? siteConfig.faq_items
    : [
      {
        q: '我们是谁',
        a: '用校园邮箱注册，花 10 分钟填写一份关于您的价值观和生活方式的问卷，并「确认参与」，然后等待。每周五晚八点，您将收到一封信封，附有 TA 的昵称、匹配度，以及我们认为你们会合拍的理由。如果您选择联系 TA，双方将各自收到对方的邮箱。接下来的流程，由你们自己决定。'
      },
      {
        q: '这是恋爱还是交友平台？',
        a: '我们希望打造吉大人的社交匹配空间，目前上线的是恋爱板块，交友板块正在紧锣密鼓的研发中，敬请期待。'
      },
      {
        q: '使用流程是什么？',
        a: '用吉大学生邮箱注册，花 10 分钟填写一份关于您的恋爱方式的问卷，然后每周五晚八点您将收到一封信封，附有您与TA的匹配度，以及我们认为你们会合拍的理由。如果您选择联系 TA，我们将为您给对方发送您的邮箱。接下来的流程，由你们自己决定。'
      },
         
      {
        q: '使用规范是什么？',
        a: '彼此真诚，互相尊重。'
      },
      {
        q: '你们如何处理我的数据？',
        a: '我们高度重视隐私保护，绝不泄露您的数据。您的问卷答案仅用于匹配，且在数据库中以随机 ID 存储，与您的邮箱地址分开保存。即使是维护团队，也无法直接将两者关联起来。'
      },
      {
        q: '联系我们',
        a: '您的每一条反馈对我们都很重要，如有问题反馈、功能建议，欢迎通过邮箱联系我们：JLUDate@163.com'
      }
   
    ];

  const whyChooseItems = Array.isArray(siteConfig.why_choose_us_items) && siteConfig.why_choose_us_items.length > 0
    ? siteConfig.why_choose_us_items
    : [
      {
        icon: 'heart',
        title: '仅限吉大',
        desc: '仅支持吉大学生邮箱注册。'
      },
      {
        icon: 'clock',
        title: '一周一次',
        desc: '一周仅一次配对，每周五晚八点统一揭晓，让等待变得有意义。'
      },
      {
        icon: 'target',
        title: '算法匹配',
        desc: '我们的配对算法基于独创的 ROSE 亲密关系模型，深度融合行为心理学、核心价值观契合度以及人际边界理论，核心逻辑是既相似也互补。与吉大校园更适配的2.0算法正在紧锣密鼓的研发中，敬请期待。'
      },
      {
        icon: 'shield',
        title: '隐私保护',
        desc: 'JLUDate 配吉友不是公开的社交平台，没有任何主页浏览。'
      }
      
    ];

  const iconMap = {
    clock: Clock,
    target: Target,
    shield: ShieldCheck,
    heart: Heart
  };

  return (
    <div className="relative z-10 min-h-screen bg-pagePink font-xihei text-slate-900">
      {/* 全页背景层（较淡，置底） */}
      <SakuraPetalsOverlay baseCount={48} />
      
      {/* 1. Hero Section：粉底 + 摄影 + 粉系渐变罩，与 pagePink 融合（非整块硬贴图） */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden text-slate-900">
        <div className="absolute inset-0 z-0 bg-pagePink" aria-hidden />
        <div className="absolute inset-0 z-[1] overflow-hidden" aria-hidden>
          <img
            src={heroPhotoSrc}
            alt=""
            className="h-full w-full object-cover object-[72%_center] md:object-[center_right] min-h-full min-w-full scale-[1.03] opacity-[0.82]"
            draggable={false}
          />
        </div>
        <div
          className="absolute inset-0 z-[2] pointer-events-none"
          aria-hidden
          style={{
            background:
              'linear-gradient(105deg, rgb(245, 234, 231) 0%, rgba(245, 234, 231, 0.92) 24%, rgba(245, 234, 231, 0.58) 44%, rgba(245, 234, 231, 0.22) 60%, transparent 76%)'
          }}
        />
        <div className="absolute inset-0 z-[3] pointer-events-none h-[45%] bg-gradient-to-b from-pagePink/50 via-pagePink/10 to-transparent" aria-hidden />

        <SakuraPetalsOverlay baseCount={56} containerClass="pointer-events-none absolute inset-0 z-[4] overflow-hidden" />

        <div className="absolute bottom-0 left-0 z-[5] w-full h-48 md:h-[320px] bg-gradient-to-b from-transparent to-pagePink pointer-events-none" />

        {/* 低饱和浅粉蒙版（约 15%），弱化摄影与花瓣细节，作氛围底 */}
        <div
          className="absolute inset-0 z-[6] pointer-events-none bg-[rgba(241,228,232,0.16)]"
          aria-hidden
        />

        <motion.div 
          initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8 }}
          className="relative z-20 text-center max-w-4xl px-4 flex flex-col items-center"
        >
          <h1 className="text-5xl md:text-7xl font-medium font-ysong mb-6 text-[#1a1a2e] leading-[1.45] tracking-[0.06em] md:tracking-[0.08em]">
            杏花佳节<br />吉遇良缘
          </h1>
          <div className="mb-8 md:mb-10 font-shsans text-sm md:text-base font-light text-[#4a4a5e] tracking-wide">
            For mails.jlu.edu.cn
          </div>
          <p className="text-lg md:text-xl mb-12 font-extralight max-w-2xl mx-auto leading-relaxed font-shsans text-[#4a4a5e] tracking-wide">
            填写一份深度问卷，每周五 20:00，收到专属于您的匹配吉友和合拍理由。
          </p>
          <button 
            onClick={() => navigate(joinTarget)}
            className="px-8 py-4 bg-ctaRose text-white font-bold rounded-full hover:bg-ctaRoseHover transition-all shadow-[0_8px_24px_rgba(224,154,173,0.32)] transform hover:-translate-y-0.5 text-lg"
          >
            {joinLabel}
          </button>
        
        </motion.div>
      </section>

      {/* 2. Countdown & Statistics */}
      <section className="py-16 bg-transparent border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-sm font-bold tracking-widest text-gray-400 uppercase mb-4">距下次配对揭晓</h3>
            <div className="flex justify-center gap-4 text-3xl md:text-5xl font-light text-szured tracking-widest font-mono">
              <div>{String(timeLeft.days).padStart(2, '0')}<span className="text-sm block text-gray-400 font-sans tracking-normal mt-1">天</span></div>:
              <div>{String(timeLeft.hours).padStart(2, '0')}<span className="text-sm block text-gray-400 font-sans tracking-normal mt-1">时</span></div>:
              <div>{String(timeLeft.minutes).padStart(2, '0')}<span className="text-sm block text-gray-400 font-sans tracking-normal mt-1">分</span></div>:
              <div>{String(timeLeft.seconds).padStart(2, '0')}<span className="text-sm block text-gray-400 font-sans tracking-normal mt-1">秒</span></div>
            </div>
          </div>
          {/* {showAnyMetric ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              {showRegisteredUsersMetric ? (
                <div className="pt-8 md:pt-0">
                  <div className="text-4xl font-bold text-gray-900 mb-2">{registeredUsersText}</div>
                  <div className="text-gray-500 font-medium">已注册用户</div>
                </div>
              ) : null}
              {showCompletionRateMetric ? (
                <div className="pt-8 md:pt-0">
                  <div className="text-4xl font-bold text-gray-900 mb-2">{completionRateText}</div>
                  <div className="text-gray-500 font-medium">问卷完成率</div>
                </div>
              ) : null}
              {showMatchedUsersMetric ? (
                <div className="pt-8 md:pt-0">
                  <div className="text-4xl font-bold text-gray-900 mb-2">{matchedUsersText}</div>
                  <div className="text-gray-500 font-medium">成功配对人数</div>
                </div>
              ) : null}
            </div>
          ) : null} */}
        </div>
      </section>

      {/* 3. How It Works */}
      <section className="py-24 bg-transparent">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-gray-900 font-ysong">如何参与</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { num: '01', title: '填写一份深度问卷', desc: '让我们充分了解您的价值观、情感风格、生活方式，让算法在七万茫茫吉大人海里，为你匹配那个频率同频的人。' },
              { num: '02', title: `每${scheduleRevealLabel}，拆开您的专属来信`, desc: '信封里藏着您与对方的匹配契合度，还有我们偷偷为你们写下的「合拍理由」。只有得到您的允许，我们才会将您的邮箱发送给对方。' },
              { num: '03', title: '赴一场属于吉大的约', desc: '故事由你们续写，在南区的清湖旁坐坐，南岭的杏花树下散步，新民的操场吹晚风，朝阳的图书馆自习，南湖的湖边散步，和平的草地上看云，从干饭搭子开始，把吉大的每一寸风景都走一遍。' }
            ].map((step, idx) => (
              <motion.div key={idx} whileHover={{ y: -10 }} className="bg-cardIvory rounded-3xl p-8 shadow-sm border border-[#E8C5CF]/60 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
                <div className="text-7xl font-black text-gray-50/80 absolute -top-4 -right-2 transition-transform group-hover:scale-110">{step.num}</div>
                <div className="relative z-10">
                  <h3 className="text-xl font-bold mb-4 text-gray-900 flex items-center gap-3 font-ysong">
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                        step.num === '01' || step.num === '02' || step.num === '03'
                          ? 'bg-roseLight text-szured'
                          : 'bg-szured text-white'
                      }`}
                    >
                      {step.num}
                    </span>
                    {step.title}
                  </h3>
                  <p className="leading-relaxed" style={{ color: 'rgba(60,53,60,0.75)' }}>{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Why Choose Us */}
      <section className="py-24 bg-transparent">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-gray-900 font-ysong">我们的特别</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {whyChooseItems.map((item, idx) => {
              const IconComponent = iconMap[item.icon] || Heart;
              return (
                <motion.div
                  key={`why-choose-${idx}`}
                  whileHover={{ y: -10 }}
                  className="bg-cardIvory p-8 rounded-3xl border border-[#E8C5CF]/60 relative overflow-hidden group hover:shadow-xl transition-all duration-300"
                >
                  <IconComponent className="w-8 h-8 text-szured mb-6" />
                  <h3 className="text-xl font-bold mb-3 font-ysong">{item.title}</h3>
                  <p style={{ color: 'rgba(60,53,60,0.75)' }}>{applySiteTokens(item.desc)}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. FAQ */}
      <section className="py-24 bg-transparent">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-gray-900 font-ysong">常见问题</h2>
          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -10 }}
                className="bg-cardIvory rounded-2xl border border-[#E8C5CF]/60 overflow-hidden relative group hover:shadow-xl transition-all duration-300"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full px-6 py-5 text-left flex justify-between items-center font-bold text-gray-900 font-ysong"
                >
                  {applySiteTokens(faq.q)}
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {openFaq === idx && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="px-6 pb-5"
                    >
                      <span style={{ color: 'rgba(60,53,60,0.75)' }}>{applySiteTokens(faq.a)}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Footer CTA */}
      <section className="py-32 text-center px-4 relative overflow-hidden bg-pagePink">
        {/* CTA 区局部花瓣（覆盖在内容前） */}
        <SakuraPetalsOverlay baseCount={24} containerClass="pointer-events-none absolute inset-0 z-10 overflow-hidden" />
        <div className="relative z-20">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 font-ysong">准备好了吗？</h2>
          <p className="text-xl text-slate-600 mb-10 font-light font-xihei">每{scheduleRevealLabel}，为你揭晓吉大校园里最契合的TA。</p>
          <button 
            onClick={() => navigate(joinTarget)}
            className="px-10 py-5 rounded-full font-bold text-white bg-ctaRose hover:bg-ctaRoseHover transition-all transform hover:scale-105 shadow-[0_8px_24px_rgba(224,154,173,0.32)] text-lg font-xihei"
          >

            {joinLabel}
          </button>
        </div>
      </section>

      <footer className="bg-footerPink py-10 text-center text-sm">
        <div className="mb-3">
          <h3 className="font-ysong text-2xl md:text-3xl font-bold m-0">
            <span className="inline-block" style={footerGoldMainStyle}>
              JLU Date
            </span>
          </h3>
          <p className="mt-2 font-xihei text-[15px]">
            <span className="inline-block" style={footerGoldSoftStyle}>
              在吉大，遇见有缘的TA。
            </span>
          </p>
        </div>
        <div
          className="mx-auto mb-3 h-px w-full max-w-md bg-[#6e5c44]/25"
          aria-hidden
        />
        <p className="font-xihei text-[13px] tracking-wide">
          <span className="inline-block" style={footerGoldSoftStyle}>
            @2026 JLUDate
          </span>
        </p>
      </footer>
    </div>
  );
}

export default Home;

