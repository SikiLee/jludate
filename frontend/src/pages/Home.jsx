import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Clock, ShieldCheck, Target, ChevronDown } from 'lucide-react';
import { useSiteConfig } from '../context/SiteConfigContext';
import { getAccessToken } from '../lib/storage';

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
    <div className="min-h-screen bg-white font-sans text-slate-900">
      
      {/* 1. Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-szured text-white">
        {homeHeroBackgroundUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${homeHeroBackgroundUrl})`, backgroundPosition: 'center top' }}
          />
        ) : null}
        <div className={`absolute inset-0 ${homeHeroBackgroundUrl ? 'bg-[#8A1538]/70 mix-blend-multiply' : 'bg-[#8A1538]/90'}`}></div>
        <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(circle at top right, #ffffff 0%, transparent 60%)' }} />
        
        {/* Soft bottom fade replacing the hard cut */}
        <div className="absolute bottom-0 left-0 w-full h-48 md:h-[400px] bg-gradient-to-t from-white via-white/50 to-transparent pointer-events-none"></div>
        
        <motion.div 
          initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8 }}
          className="relative z-10 text-center max-w-4xl px-4 flex flex-col items-center"
        >
          <div className="inline-block px-4 py-1.5 rounded-full border border-white/30 text-sm font-medium mb-6 bg-white/10 backdrop-blur-md">
            JluDate
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight leading-tight">
            杏花佳节<br />吉遇良缘
          </h1>
          <p className="text-lg md:text-xl mb-12 font-light text-white/90 max-w-2xl mx-auto leading-relaxed">
            只需填写一份深度问卷，每{scheduleRevealLabel}，您将收到匹配结果，<br className="hidden md:block"/>并附上我们认为你们会合拍的理由。
          </p>
          <button 
            onClick={() => navigate(joinTarget)}
            className="px-8 py-4 bg-white text-szured font-bold rounded-full hover:bg-gray-100 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] transform hover:-translate-y-1 text-lg"
          >
            {joinLabel}
          </button>
        
        </motion.div>
      </section>

      {/* 2. Countdown & Statistics */}
      <section className="py-16 bg-white border-b border-gray-100">
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
      <section className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-gray-900">使用流程</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { num: '01', title: '填写深度问卷', desc: '让我们充分了解您的价值观、情感风格、生活方式，让算法为您找到最契合的人。' },
              { num: '02', title: `每${scheduleRevealLabel}，打开信封`, desc: '收到您与对方的匹配度以及合拍理由，决定是否进一步联系，只有得到您的允许，我们才会将您的邮箱发送给对方' },
              { num: '03', title: '去见见TA吧!', desc: '真诚打招呼，慢慢了解彼此，把节奏交给你们自己。或许你们可以见面、散步、聊天，当然，一起约图也可以。' }
            ].map((step, idx) => (
              <motion.div key={idx} whileHover={{ y: -10 }} className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
                <div className="text-7xl font-black text-gray-50/80 absolute -top-4 -right-2 transition-transform group-hover:scale-110">{step.num}</div>
                <div className="relative z-10">
                  <h3 className="text-xl font-bold mb-4 text-gray-900 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-szured text-white flex items-center justify-center text-sm">{step.num}</span>
                    {step.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Why Choose Us */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-gray-900">为什么选择我们</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {whyChooseItems.map((item, idx) => {
              const IconComponent = iconMap[item.icon] || Heart;
              return (
                <div key={`why-choose-${idx}`} className="bg-slate-50 p-8 rounded-3xl border border-slate-100 hover:bg-slate-100 transition-colors">
                  <IconComponent className="w-8 h-8 text-szured mb-6" />
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-gray-600">{applySiteTokens(item.desc)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. FAQ */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-gray-900">常见问题</h2>
          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <button 
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full px-6 py-5 text-left flex justify-between items-center font-bold text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  {applySiteTokens(faq.q)}
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {openFaq === idx && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="px-6 pb-5 text-gray-600"
                    >
                      {applySiteTokens(faq.a)}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Footer CTA */}
      <section className="py-32 bg-slate-900 text-center px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-szured via-slate-900 to-slate-900"></div>
        <div className="relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">准备好了吗？</h2>
          <p className="text-xl text-gray-400 mb-10 font-light">每{scheduleRevealLabel}，为你揭晓最契合的 TA。</p>
          <button 
            onClick={() => navigate(joinTarget)}
            className="px-10 py-5 bg-szured text-white font-bold rounded-full hover:bg-[#a61a44] transition-all transform hover:scale-105 shadow-[0_0_30px_rgba(138,21,56,0.4)] text-lg"
          >

            {joinLabel}
          </button>
        </div>
      </section>

      <footer className="bg-slate-950 py-10 text-center text-sm text-gray-500">

        <p>© {new Date().getFullYear()} JluDate Team. .</p>
      </footer>
    </div>
  );
}

export default Home;

