import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image, Loader2, Save, Upload, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import { useSiteConfig } from '../context/SiteConfigContext';

function parseDomainsInput(rawValue) {
  if (typeof rawValue !== 'string') {
    return [];
  }

  const chunks = rawValue
    .split(/[\n,，;；\s]+/g)
    .map((item) => item.trim().toLowerCase().replace(/^@+/, ''))
    .filter(Boolean);

  return [...new Set(chunks)];
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

    setForm((prev) => ({
      ...prev,
      brand_name: brandName,
      allowed_email_domains_input: domainList.join('\n'),
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

    setSaving(true);
    try {
      const res = await api.put('/admin/site-settings', {
        brand_name: form.brand_name,
        allowed_email_domains: domains,
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

    const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('图片不能超过 5MB');
      event.target.value = '';
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

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 mb-2">站点配置</h1>
        <p className="text-slate-500">品牌名、允许邮箱域名和首页背景图。保存后立即生效。</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/70 shadow-xl p-6 md:p-8 space-y-8">
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
            placeholder={'每行一个域名，例如:\nszu.edu.cn\nthu.edu.cn'}
          />
        </section>

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

          <p className="mt-2 text-xs text-slate-500">仅支持 JPG / PNG / WEBP，最大 5MB。</p>
        </section>

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
