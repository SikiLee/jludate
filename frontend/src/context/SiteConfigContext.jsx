import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';

const DEFAULT_SETTINGS = {
  brand_name: 'JLUDate',
  allowed_email_domains: ['mails.jlu.edu.cn'],
  match_schedule: {
    day_of_week: 5,
    hour: 20,
    minute: 0,
    timezone: 'Asia/Shanghai'
  },
  why_choose_us_items: [
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
  ],
  faq_items: [
    {
      q: '使用流程是什么？',
      a: '用校园邮箱注册，花 10 分钟填写一份关于您的价值观和生活方式的问卷，并「确认参与」，然后等待。每周五晚八点，您将收到一封信封，附有 TA 的昵称、匹配度，以及我们认为你们会合拍的理由。如果您选择联系 TA，双方将各自收到对方的邮箱。接下来的流程，由你们自己决定。'
    },
    {
      q: '你们如何处理我的数据？',
      a: '我们绝不出售您的数据。您的问卷答案仅用于匹配，且在数据库中以随机 ID 存储，与您的邮箱地址分开保存。即使是维护团队，也无法直接将两者关联起来。详见隐私协议。'
    },
    {
      q: '{XXDate} 的使用规范是什么？',
      a: '彼此真诚，互相尊重。'
    },
    {
      q: '配对算法是如何工作的？',
      a: '我们的配对系统基于独创的 ROSE 亲密关系模型，深度融合行为心理学、核心价值观契合度以及人际边界理论。核心逻辑是“底线一致，特质互补”：在原则和三观上寻找同频，在性格与沟通方式上捕捉能产生化学反应的良性差异。'
    }
  ],
  cross_school_matching_enabled: false,
  home_hero_background_url: null,
  updated_at: null
};

const SiteConfigContext = createContext({
  siteConfig: DEFAULT_SETTINGS,
  loading: true,
  refreshSiteConfig: async () => {}
});

function normalizeSettings(rawValue) {
  const payload = rawValue && typeof rawValue === 'object' ? rawValue : {};
  const brandName = typeof payload.brand_name === 'string' && payload.brand_name.trim()
    ? payload.brand_name.trim()
    : DEFAULT_SETTINGS.brand_name;

  const allowedEmailDomains = Array.isArray(payload.allowed_email_domains)
    ? payload.allowed_email_domains
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim().toLowerCase().replace(/^@+/, ''))
      .filter(Boolean)
    : [];

  const rawMatchSchedule = payload.match_schedule && typeof payload.match_schedule === 'object'
    ? payload.match_schedule
    : {};
  const dayOfWeek = Number.isInteger(rawMatchSchedule.day_of_week) && rawMatchSchedule.day_of_week >= 0 && rawMatchSchedule.day_of_week <= 6
    ? rawMatchSchedule.day_of_week
    : DEFAULT_SETTINGS.match_schedule.day_of_week;
  const hour = Number.isInteger(rawMatchSchedule.hour) && rawMatchSchedule.hour >= 0 && rawMatchSchedule.hour <= 23
    ? rawMatchSchedule.hour
    : DEFAULT_SETTINGS.match_schedule.hour;
  const minute = Number.isInteger(rawMatchSchedule.minute) && rawMatchSchedule.minute >= 0 && rawMatchSchedule.minute <= 59
    ? rawMatchSchedule.minute
    : DEFAULT_SETTINGS.match_schedule.minute;

  const faqItems = Array.isArray(payload.faq_items)
    ? payload.faq_items
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        q: typeof item.q === 'string' ? item.q.trim() : '',
        a: typeof item.a === 'string' ? item.a.trim() : ''
      }))
      .filter((item) => item.q && item.a)
    : [];

  const whyChooseUsItems = Array.isArray(payload.why_choose_us_items)
    ? payload.why_choose_us_items
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        icon: typeof item.icon === 'string' ? item.icon.trim().toLowerCase() : '',
        title: typeof item.title === 'string' ? item.title.trim() : '',
        desc: typeof item.desc === 'string' ? item.desc.trim() : ''
      }))
      .filter((item) => ['clock', 'target', 'shield', 'heart'].includes(item.icon) && item.title && item.desc)
    : [];

  return {
    brand_name: brandName,
    allowed_email_domains: allowedEmailDomains.length > 0 ? [...new Set(allowedEmailDomains)] : DEFAULT_SETTINGS.allowed_email_domains,
    match_schedule: {
      day_of_week: dayOfWeek,
      hour,
      minute,
      timezone: 'Asia/Shanghai'
    },
    why_choose_us_items: whyChooseUsItems.length > 0 ? whyChooseUsItems : DEFAULT_SETTINGS.why_choose_us_items,
    faq_items: faqItems.length > 0 ? faqItems : DEFAULT_SETTINGS.faq_items,
    cross_school_matching_enabled: typeof payload.cross_school_matching_enabled === 'boolean'
      ? payload.cross_school_matching_enabled
      : DEFAULT_SETTINGS.cross_school_matching_enabled,
    home_hero_background_url: typeof payload.home_hero_background_url === 'string' && payload.home_hero_background_url
      ? payload.home_hero_background_url
      : null,
    updated_at: payload.updated_at || null
  };
}

export function SiteConfigProvider({ children }) {
  const [siteConfig, setSiteConfig] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refreshSiteConfig = async () => {
    try {
      const response = await api.get('/public/site-settings', { skipAuthRedirect: true });
      const nextConfig = normalizeSettings(response.data?.data);
      setSiteConfig(nextConfig);
      return nextConfig;
    } catch {
      setSiteConfig(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSiteConfig();
  }, []);

  useEffect(() => {
    document.title = 'JLUDate|吉大校园公益匹配平台';
  }, [siteConfig.brand_name]);

  const value = useMemo(
    () => ({ siteConfig, loading, refreshSiteConfig }),
    [siteConfig, loading]
  );

  return (
    <SiteConfigContext.Provider value={value}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig() {
  return useContext(SiteConfigContext);
}
