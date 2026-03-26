import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, MessageSquareText, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import { getAccessToken } from '../lib/storage';

const FEEDBACK_SOURCE_SET = new Set(['banner', 'survey_result']);

function resolveFeedbackSource(search) {
  const searchParams = new URLSearchParams(search);
  const from = (searchParams.get('from') || '').trim().toLowerCase();
  if (FEEDBACK_SOURCE_SET.has(from)) {
    return from;
  }
  return 'other';
}

function resolveRoseCode(search) {
  const searchParams = new URLSearchParams(search);
  const rose = (searchParams.get('rose') || '').trim().toUpperCase();
  if (!rose) {
    return '';
  }
  return /^[A-Z0-9_-]{1,16}$/.test(rose) ? rose : '';
}

function Feedback() {
  const navigate = useNavigate();
  const location = useLocation();
  const isLoggedIn = Boolean(getAccessToken());
  const feedbackSource = useMemo(() => resolveFeedbackSource(location.search), [location.search]);
  const roseCode = useMemo(() => resolveRoseCode(location.search), [location.search]);
  const [content, setContent] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalizedContent = content.trim();
    if (!normalizedContent) {
      toast.error('请先填写反馈内容');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/feedback', {
        content: normalizedContent,
        contact_email: contactEmail.trim() || null,
        source: feedbackSource,
        rose_code: roseCode || null
      });
      toast.success('反馈已提交，感谢你的建议');
      setContent('');
      if (!isLoggedIn) {
        setContactEmail('');
      }
    } catch {
      // handled by interceptor
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 py-10 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>

        <div className="bg-white rounded-3xl border border-slate-200/70 shadow-sm p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <MessageSquareText className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">用户反馈</h1>
          </div>
          <p className="text-slate-500 mb-6">你可以反馈体验问题、功能建议或任何想法，管理员会在后台查看。</p>

          <div className="flex flex-wrap gap-2 mb-6">
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
              来源：{feedbackSource === 'banner' ? '首页 Banner' : feedbackSource === 'survey_result' ? '问卷完成页' : '其他'}
            </span>
            {roseCode ? (
              <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
                ROSE 类型：{roseCode}
              </span>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="feedback-content" className="block text-sm font-bold text-slate-700 mb-2">
                反馈内容
              </label>
              <textarea
                id="feedback-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="例如：某一步文案看不懂、某个功能希望增加、某处体验不顺畅..."
                maxLength={2000}
                rows={8}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition resize-y"
              />
              <p className="mt-1 text-xs text-slate-400 text-right">{content.trim().length}/2000</p>
            </div>

            <div>
              <label htmlFor="feedback-contact-email" className="block text-sm font-bold text-slate-700 mb-2">
                联系邮箱（可选）
              </label>
              <input
                id="feedback-contact-email"
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                placeholder="如需回访可填写"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-black transition disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              提交反馈
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Feedback;
