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
        q: '使用流程是什么？',
        a: '用校园邮箱注册，花 10 分钟填写一份关于您的价值观和生活方式的问卷，并「确认参与」，然后等待。每周五晚八点，您将收到一封信封，附有 TA 的昵称、匹配度，以及我们认为你们会合拍的理由。如果您选择联系 TA，双方将各自收到对方的邮箱。接下来的流程，由你们自己决定。'
      },
      {
        q: '你们如何处理我的数据？',
        a: '我们绝不泄露您的数据。您的问卷答案仅用于匹配，且在数据库中以随机 ID 存储，与您的邮箱地址分开保存。即使是维护团队，也无法直接将两者关联起来。详见隐私协议。'
      },
      {
        q: '配吉友 的使用规范是什么？',
        a: '彼此真诚，互相尊重。'
      },
      {
        q: '配对算法是如何工作的？',
        a: '我们的配对系统基于独创的 ROSE 亲密关系模型，深度融合行为心理学、核心价值观契合度以及人际边界理论。核心逻辑是“底线一致，特质互补”：在原则和三观上寻找同频，在性格与沟通方式上捕捉能产生化学反应的良性差异。'
      }
    ];

  const whyChooseItems = Array.isArray(siteConfig.why_choose_us_items) && siteConfig.why_choose_us_items.length > 0
    ? siteConfig.why_choose_us_items
    : [
      {
        icon: 'clock',
        title: '每周一次',
        desc: '没有"左滑右滑"。每周五晚八点统一揭晓，一周至多一次配对，让等待变得有意义。'
      },
      {
        icon: 'target',
        title: '精准匹配',
        desc: '基于价值观、情感风格等深度研究与科学算法，不只看相似，也捕捉互补的差异。'
      },
      {
        icon: 'shield',
        title: '隐私优先',
        desc: '{XXDate} 不是公开的社交平台。没有任何主页浏览，任何人除每周收到匹配外，只能看到与自己有关的信息。'
      },
      {
        icon: 'heart',
        title: '校园认证',
        desc: '仅支持 {ALLOWED_DOMAINS} 邮箱注册。封闭纯粹的校园环境，让相认更加真实可靠。'
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
      
      {/* 1. Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-pagePink text-slate-900">
        {/* 首屏局部花瓣（覆盖在内容前，但不影响交互）——加密 */}
        <SakuraPetalsOverlay baseCount={56} containerClass="pointer-events-none absolute inset-0 z-10 overflow-hidden" />
        
        {/* Feathered bottom fade into page background */}
        <div className="absolute bottom-0 left-0 w-full h-48 md:h-[320px] bg-gradient-to-b from-transparent to-pagePink pointer-events-none"></div>
        
        <motion.div 
          initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8 }}
          className="relative z-20 text-center max-w-4xl px-4 flex flex-col items-center"
        >
          <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight leading-tight font-ysong">
            杏花佳节<br />吉遇良缘
          </h1>
          <div className="mb-4 font-ysong text-sm md:text-base" style={{ color: '#E8C5CF' }}>
            For mails.jlu.edu.cn
          </div>
          <p className="text-lg md:text-xl mb-12 font-light max-w-2xl mx-auto leading-relaxed font-shsans" style={{ color: 'rgba(60,53,60,0.8)' }}>
            只需填写一份深度问卷，每{scheduleRevealLabel}，<br />您将收到匹配结果，并附上我们认为你们会合拍的理由。
          </p>
          <button 
            onClick={() => navigate(joinTarget)}
            className="px-8 py-4 bg-[#B54D69] text-white font-bold rounded-full hover:brightness-110 transition-all shadow-[0_8px_24px_rgba(181,77,105,0.35)] transform hover:-translate-y-0.5 text-lg"
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
              { num: '01', title: '填写深度问卷', desc: '让我们充分了解您的价值观、情感风格、生活方式，让算法为您找到最契合的人。' },
              { num: '02', title: `每${scheduleRevealLabel}，打开信封`, desc: '收到您与对方的匹配度以及合拍理由，决定是否进一步联系，只有得到您的允许，我们才会将您的邮箱发送给对方' },
              { num: '03', title: '去见见TA吧!', desc: '真诚打招呼，慢慢了解彼此，把节奏交给你们自己。或许你们可以见面、散步、聊天，当然，一起约图也可以。' }
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
            className="px-10 py-5 rounded-full font-bold text-white bg-[#B54D69] hover:brightness-110 transition-all transform hover:scale-105 shadow-[0_8px_24px_rgba(0,0,0,0.2)] text-lg font-xihei"
          >

            {joinLabel}
          </button>
        </div>
      </section>

      <footer className="bg-[#582333] py-10 text-center text-sm text-gray-500">
        <div className="mb-3">
          <h3 className="font-ysong text-white/90 text-2xl md:text-3xl font-bold">JLU Date</h3>
          <p className="mt-2 font-xihei" style={{ color: 'rgba(197,132,149,0.62)' }}>在吉大，遇见有缘的TA。</p>
        </div>
        <p style={{ color: 'rgba(204,120,140,0.6)' }}>© {new Date().getFullYear()} JluDate Team.</p>
      </footer>
    </div>
  );
}

export default Home;

