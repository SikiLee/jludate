import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image, Loader2, Save, Upload, Trash2, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import { useSiteConfig } from '../context/SiteConfigContext';

function parseDomainsInput(rawValue) {
  if (typeof rawValue !== 'string') {
    return [];
  }

  const chunks = rawValue
    .split(/[\n,，、;；\s]+/g)
    .map((item) => item.trim().toLowerCase().replace(/^@+/, ''))
    .filter(Boolean);

  return [...new Set(chunks)];
}

function ConfigSection({ title, defaultOpen = false, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden mb-6">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 transition"
      >
        <span className="text-base font-bold text-slate-800">{title}</span>
        <ChevronDown 
          className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>
      {isOpen && (
        <div className="p-6 border-t border-slate-100 space-y-6">
          {children}
        </div>
      )}
    </div>
  );
}

const DEFAULT_FAQ_ITEMS = [
  {
    q: '使用流程是什么？',
    a: '用校园邮箱注册，花 10 分钟填写一份关于您的价值观和生活方式的问卷，并「确认参与」，然后等待。每周二晚九点，您将收到一封信封，附有 TA 的昵称、匹配度，以及我们认为你们会合拍的理由。如果您选择联系 TA，双方将各自收到对方的邮箱。接下来的流程，由你们自己决定。'
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
];

const WHY_CHOOSE_ICON_OPTIONS = [
  { value: 'clock', label: '每周一次（Clock）' },
  { value: 'target', label: '精准匹配（Target）' },
  { value: 'shield', label: '隐私优先（Shield）' },
  { value: 'heart', label: '校园认证（Heart）' }
];

const MATCH_DAY_OPTIONS = [
  { value: 0, label: '周日' },
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' }
];

const DEFAULT_WHY_CHOOSE_US_ITEMS = [
  {
    icon: 'clock',
    title: '每周一次',
    desc: '没有"左滑右滑"。每周二晚九点统一揭晓，一周至多一次配对，让等待变得有意义。'
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

const DEFAULT_HOME_METRICS_VISIBILITY = {
  registered_users: true,
  survey_completion_rate: true,
  matched_users: true
};
const DEFAULT_EMAIL_TEMPLATES = {
  verification: {
    subject: '{{brand_name}} Registration Verification',
    body: '【{{brand_name}}】您的验证码是: {{code}}\n一次深度问卷，匹配一个和你最契合的人。欢迎加入校园专属配对平台！'
  },
  match_result: {
    subject: '【{{brand_name}}】你的本周匹配结果已送达',
    body: [
      '【{{brand_name}} 每周匹配】',
      '你已成功匹配，请登录网站查看匹配详情与对话。',
      '查看入口：{{match_url}}',
      '派发时间：{{run_at}} ({{timezone}})'
    ].join('\n')
  }
};

function normalizeFaqItems(rawValue) {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      q: typeof item.q === 'string' ? item.q.trim() : '',
      a: typeof item.a === 'string' ? item.a.trim() : ''
    }))
    .filter((item) => item.q && item.a);
}

function normalizeWhyChooseUsItems(rawValue) {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  const validIcons = new Set(WHY_CHOOSE_ICON_OPTIONS.map((item) => item.value));
  return rawValue
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      icon: typeof item.icon === 'string' ? item.icon.trim().toLowerCase() : '',
      title: typeof item.title === 'string' ? item.title.trim() : '',
      desc: typeof item.desc === 'string' ? item.desc.trim() : ''
    }))
    .filter((item) => validIcons.has(item.icon) && item.title && item.desc);
}

function normalizeHomeMetricsVisibility(rawValue) {
  if (!rawValue || typeof rawValue !== 'object') {
    return { ...DEFAULT_HOME_METRICS_VISIBILITY };
  }

  return {
    registered_users: typeof rawValue.registered_users === 'boolean'
      ? rawValue.registered_users
      : DEFAULT_HOME_METRICS_VISIBILITY.registered_users,
    survey_completion_rate: typeof rawValue.survey_completion_rate === 'boolean'
      ? rawValue.survey_completion_rate
      : DEFAULT_HOME_METRICS_VISIBILITY.survey_completion_rate,
    matched_users: typeof rawValue.matched_users === 'boolean'
      ? rawValue.matched_users
      : DEFAULT_HOME_METRICS_VISIBILITY.matched_users
  };
}

function normalizeEmailTemplates(rawValue) {
  if (!rawValue || typeof rawValue !== 'object') {
    return JSON.parse(JSON.stringify(DEFAULT_EMAIL_TEMPLATES));
  }

  const verification = rawValue.verification && typeof rawValue.verification === 'object'
    ? rawValue.verification
    : {};
  const matchResult = rawValue.match_result && typeof rawValue.match_result === 'object'
    ? rawValue.match_result
    : {};

  const verificationSubject = typeof verification.subject === 'string' ? verification.subject.trim() : '';
  const verificationBody = typeof verification.body === 'string' ? verification.body.replace(/\r\n/g, '\n').trim() : '';
  const matchResultSubject = typeof matchResult.subject === 'string' ? matchResult.subject.trim() : '';
  const matchResultBody = typeof matchResult.body === 'string' ? matchResult.body.replace(/\r\n/g, '\n').trim() : '';

  return {
    verification: {
      subject: verificationSubject || DEFAULT_EMAIL_TEMPLATES.verification.subject,
      body: verificationBody || DEFAULT_EMAIL_TEMPLATES.verification.body
    },
    match_result: {
      subject: matchResultSubject || DEFAULT_EMAIL_TEMPLATES.match_result.subject,
      body: matchResultBody || DEFAULT_EMAIL_TEMPLATES.match_result.body
    }
  };
}

function AdminSiteSettings() {
  const navigate = useNavigate();
  const { refreshSiteConfig } = useSiteConfig();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingImage, setDeletingImage] = useState(false);
  const [form, setForm] = useState({
    brand_name: 'unidate',
    allowed_email_domains_input: 'szu.edu.cn',
    match_schedule: { day_of_week: 2, hour: 21, minute: 0, timezone: 'Asia/Shanghai' },
    cross_school_matching_enabled: false,
    home_metrics_visibility: DEFAULT_HOME_METRICS_VISIBILITY,
    email_templates: DEFAULT_EMAIL_TEMPLATES,
    why_choose_us_items: DEFAULT_WHY_CHOOSE_US_ITEMS,
    faq_items: DEFAULT_FAQ_ITEMS,
    home_hero_background_url: null,
    home_hero_background: null
  });

  const handleForbidden = () => {
    toast.error('仅管理员可访问');
    navigate('/survey', { replace: true });
  };

  const applyPayload = (payload) => {
    const brandName = payload?.brand_name || 'unidate';
    const domainList = Array.isArray(payload?.allowed_email_domains) && payload.allowed_email_domains.length > 0
      ? payload.allowed_email_domains
      : ['szu.edu.cn'];
    const whyChooseUsItems = normalizeWhyChooseUsItems(payload?.why_choose_us_items);
    const faqItems = normalizeFaqItems(payload?.faq_items);
    const homeMetricsVisibility = normalizeHomeMetricsVisibility(payload?.home_metrics_visibility);
    const emailTemplates = normalizeEmailTemplates(payload?.email_templates);
    const crossSchoolMatchingEnabled = typeof payload?.cross_school_matching_enabled === 'boolean'
      ? payload.cross_school_matching_enabled
      : false;
    const payloadSchedule = payload?.match_schedule && typeof payload.match_schedule === 'object'
      ? payload.match_schedule
      : {};
    const matchSchedule = {
      day_of_week: Number.isInteger(payloadSchedule.day_of_week) && payloadSchedule.day_of_week >= 0 && payloadSchedule.day_of_week <= 6
        ? payloadSchedule.day_of_week
        : 2,
      hour: Number.isInteger(payloadSchedule.hour) && payloadSchedule.hour >= 0 && payloadSchedule.hour <= 23
        ? payloadSchedule.hour
        : 21,
      minute: Number.isInteger(payloadSchedule.minute) && payloadSchedule.minute >= 0 && payloadSchedule.minute <= 59
        ? payloadSchedule.minute
        : 0,
      timezone: 'Asia/Shanghai'
    };

    setForm((prev) => ({
      ...prev,
      brand_name: brandName,
      allowed_email_domains_input: domainList.join('\n'),
      match_schedule: matchSchedule,
      cross_school_matching_enabled: crossSchoolMatchingEnabled,
      home_metrics_visibility: homeMetricsVisibility,
      email_templates: emailTemplates,
      why_choose_us_items: whyChooseUsItems.length > 0 ? whyChooseUsItems : DEFAULT_WHY_CHOOSE_US_ITEMS,
      faq_items: faqItems.length > 0 ? faqItems : DEFAULT_FAQ_ITEMS,
      home_hero_background_url: payload?.home_hero_background_url || null,
      home_hero_background: payload?.home_hero_background || null
    }));
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/site-settings');
      applyPayload(res.data?.data || {});
    } catch (error) {
      if (error?.response?.status === 403) {
        handleForbidden();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const domainCount = useMemo(
    () => parseDomainsInput(form.allowed_email_domains_input).length,
    [form.allowed_email_domains_input]
  );

  const handleSave = async () => {
    const domains = parseDomainsInput(form.allowed_email_domains_input);
    if (!form.brand_name.trim()) {
      toast.error('请填写站点名称');
      return;
    }
    if (domains.length === 0) {
      toast.error('请至少填写一个邮箱域名');
      return;
    }
    const faqItems = normalizeFaqItems(form.faq_items);
    if (faqItems.length === 0) {
      toast.error('请至少配置一个常见问题');
      return;
    }
    const whyChooseUsItems = normalizeWhyChooseUsItems(form.why_choose_us_items);
    if (whyChooseUsItems.length === 0) {
      toast.error('请至少配置一个“为什么选择我们”条目');
      return;
    }
    const dayOfWeek = Number(form.match_schedule?.day_of_week);
    const hour = Number(form.match_schedule?.hour);
    const minute = Number(form.match_schedule?.minute);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      toast.error('请选择有效的配对星期');
      return;
    }
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      toast.error('请选择有效的配对小时');
      return;
    }
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
      toast.error('请选择有效的配对分钟');
      return;
    }
    const emailTemplates = normalizeEmailTemplates(form.email_templates);
    if (!emailTemplates.verification.subject || !emailTemplates.verification.body) {
      toast.error('请完整填写验证码邮件模板');
      return;
    }
    if (!emailTemplates.match_result.subject || !emailTemplates.match_result.body) {
      toast.error('请完整填写匹配结果邮件模板');
      return;
    }

    setSaving(true);
    try {
      const res = await api.put('/admin/site-settings', {
        brand_name: form.brand_name,
        allowed_email_domains: domains,
        match_schedule: {
          day_of_week: dayOfWeek,
          hour,
          minute
        },
        cross_school_matching_enabled: Boolean(form.cross_school_matching_enabled),
        home_metrics_visibility: normalizeHomeMetricsVisibility(form.home_metrics_visibility),
        email_templates: emailTemplates,
        why_choose_us_items: whyChooseUsItems,
        faq_items: faqItems
      });
      applyPayload(res.data?.data || {});
      await refreshSiteConfig();
      toast.success('站点配置已保存');
    } catch (error) {
      if (error?.response?.status === 403) {
        handleForbidden();
      } else {
        toast.error('保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await api.post('/admin/site-settings/home-hero-background', formData);
      applyPayload(res.data?.data || {});
      await refreshSiteConfig();
      toast.success('首页背景图已更新');
    } catch (error) {
      if (error?.response?.status === 403) {
        handleForbidden();
      } else {
        toast.error('上传失败');
      }
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDeleteBackground = async () => {
    if (!window.confirm('确认删除首页背景图并回退默认背景吗？')) {
      return;
    }

    setDeletingImage(true);
    try {
      const res = await api.delete('/admin/site-settings/home-hero-background');
      applyPayload(res.data?.data || {});
      await refreshSiteConfig();
      toast.success('首页背景图已删除');
    } catch (error) {
      if (error?.response?.status === 403) {
        handleForbidden();
      } else {
        toast.error('删除失败');
      }
    } finally {
      setDeletingImage(false);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const handleFaqChange = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      faq_items: prev.faq_items.map((item, idx) => (
        idx === index ? { ...item, [key]: value } : item
      ))
    }));
  };

  const handleAddFaq = () => {
    setForm((prev) => ({
      ...prev,
      faq_items: [...prev.faq_items, { q: '', a: '' }]
    }));
  };

  const handleDeleteFaq = (index) => {
    setForm((prev) => {
      if (prev.faq_items.length <= 1) {
        return prev;
      }
      return {
        ...prev,
        faq_items: prev.faq_items.filter((_, idx) => idx !== index)
      };
    });
  };

  const handleWhyChooseChange = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      why_choose_us_items: prev.why_choose_us_items.map((item, idx) => (
        idx === index ? { ...item, [key]: value } : item
      ))
    }));
  };

  const handleAddWhyChoose = () => {
    setForm((prev) => ({
      ...prev,
      why_choose_us_items: [...prev.why_choose_us_items, { icon: 'heart', title: '', desc: '' }]
    }));
  };

  const handleDeleteWhyChoose = (index) => {
    setForm((prev) => {
      if (prev.why_choose_us_items.length <= 1) {
        return prev;
      }
      return {
        ...prev,
        why_choose_us_items: prev.why_choose_us_items.filter((_, idx) => idx !== index)
      };
    });
  };

  const handleEmailTemplateChange = (templateKey, fieldKey, value) => {
    setForm((prev) => {
      const normalizedTemplates = normalizeEmailTemplates(prev.email_templates);
      return {
        ...prev,
        email_templates: {
          ...normalizedTemplates,
          [templateKey]: {
            ...normalizedTemplates[templateKey],
            [fieldKey]: value
          }
        }
      };
    });
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 mb-2">站点配置</h1>
        <p className="text-slate-500">品牌名、允许邮箱域名和首页背景图。保存后立即生效。</p>
      </div>

      <div className="space-y-6">
        <ConfigSection title="基本设置" defaultOpen={true}>
          <section>
          <label className="block text-sm font-bold text-slate-700 mb-2">站点名称</label>
          <input
            type="text"
            value={form.brand_name}
            onChange={(e) => setForm((prev) => ({ ...prev, brand_name: e.target.value }))}
            className="w-full max-w-lg px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition"
            placeholder="例如：THUDate"
          />
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-bold text-slate-700">允许邮箱域名</label>
            <span className="text-xs text-slate-500">已识别 {domainCount} 个域名</span>
          </div>
          <textarea
            value={form.allowed_email_domains_input}
            onChange={(e) => setForm((prev) => ({ ...prev, allowed_email_domains_input: e.target.value }))}
            className="w-full max-w-2xl min-h-[120px] px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition font-mono text-sm"
            placeholder={'每行一个域名或通配规则，例如:\nszu.edu.cn\nthu.edu.cn\n*.edu.cn'}
          />
        </section>

        </ConfigSection>

        <ConfigSection title="自动配对设置" defaultOpen={false}>
          <section>
            <label className="block text-sm font-bold text-slate-700 mb-2">自动配对时间（Asia/Shanghai）</label>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={form.match_schedule.day_of_week}
              onChange={(e) => {
                const value = Number(e.target.value);
                setForm((prev) => ({
                  ...prev,
                  match_schedule: { ...prev.match_schedule, day_of_week: value }
                }));
              }}
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition"
            >
              {MATCH_DAY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select
              value={form.match_schedule.hour}
              onChange={(e) => {
                const value = Number(e.target.value);
                setForm((prev) => ({
                  ...prev,
                  match_schedule: { ...prev.match_schedule, hour: value }
                }));
              }}
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition"
            >
              {Array.from({ length: 24 }, (_, index) => (
                <option key={`hour-${index}`} value={index}>{String(index).padStart(2, '0')} 时</option>
              ))}
            </select>

            <span className="text-slate-400 font-semibold">:</span>

            <select
              value={form.match_schedule.minute}
              onChange={(e) => {
                const value = Number(e.target.value);
                setForm((prev) => ({
                  ...prev,
                  match_schedule: { ...prev.match_schedule, minute: value }
                }));
              }}
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition"
            >
              {Array.from({ length: 60 }, (_, index) => (
                <option key={`minute-${index}`} value={index}>{String(index).padStart(2, '0')} 分</option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-xs text-slate-500">到达设定分钟后，系统将自动执行本周配对。</p>
        </section>

        <section className="pt-4 border-t border-slate-100">
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(form.cross_school_matching_enabled)}
              onChange={(e) => {
                const nextValue = e.target.checked;
                setForm((prev) => ({
                  ...prev,
                  cross_school_matching_enabled: nextValue
                }));
              }}
              className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            />
            开启外校匹配（用户可在问卷中选择是否接受外校对象）
          </label>
          <p className="mt-2 text-xs text-slate-500">
            关闭时：所有用户仅在本校范围匹配。开启时：仅选择“允许外校匹配”的用户会参与跨校配对。
          </p>
        </section>

        </ConfigSection>

        <ConfigSection title="首页数据公开设置" defaultOpen={false}>
          <section>
            <p className="text-sm text-slate-600 mb-3">一键控制首页三项统计是否公开（已注册用户 / 问卷完成率 / 成功配对人数）。</p>
            <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={
                  Boolean(form.home_metrics_visibility?.registered_users)
                  && Boolean(form.home_metrics_visibility?.survey_completion_rate)
                  && Boolean(form.home_metrics_visibility?.matched_users)
                }
                onChange={(e) => {
                  const nextValue = e.target.checked;
                  setForm((prev) => ({
                    ...prev,
                    home_metrics_visibility: {
                      registered_users: nextValue,
                      survey_completion_rate: nextValue,
                      matched_users: nextValue
                    }
                  }));
                }}
                className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              公开首页统计数据（3项）
            </label>
          </section>
        </ConfigSection>

        <ConfigSection title="邮件模板设置" defaultOpen={false}>
          <section className="space-y-4">
            <p className="text-sm text-slate-600">
              支持参数：<code>{'{{brand_name}}'}</code>、<code>{'{{code}}'}</code>、<code>{'{{match_url}}'}</code>、<code>{'{{partner_email}}'}</code>、<code>{'{{match_percent}}'}</code>、<code>{'{{self_rose}}'}</code>、<code>{'{{partner_rose}}'}</code>、<code>{'{{run_at}}'}</code>、<code>{'{{timezone}}'}</code>
            </p>

            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
              <h3 className="text-sm font-bold text-slate-700">注册验证码邮件</h3>
              <input
                type="text"
                value={form.email_templates?.verification?.subject || ''}
                onChange={(e) => handleEmailTemplateChange('verification', 'subject', e.target.value)}
                placeholder="邮件标题"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition"
              />
              <textarea
                value={form.email_templates?.verification?.body || ''}
                onChange={(e) => handleEmailTemplateChange('verification', 'body', e.target.value)}
                placeholder="邮件正文"
                className="w-full min-h-[120px] px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition font-mono text-sm"
              />
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
              <h3 className="text-sm font-bold text-slate-700">匹配结果邮件</h3>
              <input
                type="text"
                value={form.email_templates?.match_result?.subject || ''}
                onChange={(e) => handleEmailTemplateChange('match_result', 'subject', e.target.value)}
                placeholder="邮件标题"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition"
              />
              <textarea
                value={form.email_templates?.match_result?.body || ''}
                onChange={(e) => handleEmailTemplateChange('match_result', 'body', e.target.value)}
                placeholder="邮件正文"
                className="w-full min-h-[160px] px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition font-mono text-sm"
              />
            </div>
          </section>
        </ConfigSection>

        <ConfigSection title="首页“为什么选择我们”" defaultOpen={false}>
          <section>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-bold text-slate-700">首页“为什么选择我们”</label>
            <button
              type="button"
              onClick={handleAddWhyChoose}
              className="px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-sm font-semibold"
            >
              新增条目
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-3">支持变量：`{'{XXDate}'}`、`{'{ALLOWED_DOMAINS}'}`</p>

          <div className="space-y-4">
            {form.why_choose_us_items.map((item, index) => (
              <div key={`why-choose-${index}`} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">条目 #{index + 1}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteWhyChoose(index)}
                    disabled={form.why_choose_us_items.length <= 1}
                    className="text-xs text-rose-600 hover:text-rose-700 disabled:text-slate-300"
                  >
                    删除
                  </button>
                </div>

                <select
                  value={item.icon}
                  onChange={(e) => handleWhyChooseChange(index, 'icon', e.target.value)}
                  className="w-full md:w-72 px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition"
                >
                  {WHY_CHOOSE_ICON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>

                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => handleWhyChooseChange(index, 'title', e.target.value)}
                  placeholder="标题，例如：每周一次"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition"
                />

                <textarea
                  value={item.desc}
                  onChange={(e) => handleWhyChooseChange(index, 'desc', e.target.value)}
                  placeholder="描述内容"
                  className="w-full min-h-[96px] px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition"
                />
              </div>
            ))}
          </div>
        </section>

        </ConfigSection>

        <ConfigSection title="首页常见问题（FAQ）" defaultOpen={false}>
          <section>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-bold text-slate-700">首页常见问题（FAQ）</label>
            <button
              type="button"
              onClick={handleAddFaq}
              className="px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-sm font-semibold"
            >
              新增问题
            </button>
          </div>

          <div className="space-y-4">
            {form.faq_items.map((item, index) => (
              <div key={`faq-${index}`} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">问题 #{index + 1}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteFaq(index)}
                    disabled={form.faq_items.length <= 1}
                    className="text-xs text-rose-600 hover:text-rose-700 disabled:text-slate-300"
                  >
                    删除
                  </button>
                </div>

                <input
                  type="text"
                  value={item.q}
                  onChange={(e) => handleFaqChange(index, 'q', e.target.value)}
                  placeholder="问题，例如：你们如何处理我的数据？"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition"
                />

                <textarea
                  value={item.a}
                  onChange={(e) => handleFaqChange(index, 'a', e.target.value)}
                  placeholder="答案内容"
                  className="w-full min-h-[96px] px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition"
                />
              </div>
            ))}
          </div>
        </section>

        </ConfigSection>

        <ConfigSection title="视觉与背景图" defaultOpen={false}>
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Image className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-700">首页背景图</h2>
          </div>

          {form.home_hero_background_url ? (
            <div className="mb-4 max-w-2xl rounded-2xl overflow-hidden border border-slate-200">
              <img
                src={form.home_hero_background_url}
                alt="home hero"
                className="w-full h-52 object-cover"
              />
            </div>
          ) : (
            <p className="text-sm text-slate-500 mb-4">当前未设置背景图，首页将使用默认视觉背景。</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <label className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700 cursor-pointer inline-flex items-center gap-2">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              上传图片
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={handleDeleteBackground}
              disabled={deletingImage || !form.home_hero_background_url}
              className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold inline-flex items-center gap-2 disabled:opacity-50"
            >
              {deletingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              删除背景图
            </button>
          </div>

          <p className="mt-2 text-xs text-slate-500">仅支持 JPG / PNG / WEBP。</p>
        </section>
      </ConfigSection>
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold inline-flex items-center gap-2 shadow-lg shadow-violet-500/30 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            保存站点配置
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminSiteSettings;
