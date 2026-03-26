import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, MessageSquareText, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

const PAGE_SIZE = 30;

function formatFeedbackTime(value) {
  if (!value) {
    return '--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }
  return date.toLocaleString('zh-CN', { hour12: false });
}

function AdminFeedback() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  const handleForbidden = () => {
    toast.error('仅管理员可访问');
    navigate('/survey', { replace: true });
  };

  const fetchFeedback = async (nextOffset = 0, silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await api.get('/admin/feedback', {
        params: {
          limit: PAGE_SIZE,
          offset: nextOffset
        }
      });
      const data = res.data?.data || {};
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number.isFinite(data.total) ? data.total : 0);
      setOffset(Number.isFinite(data.offset) ? data.offset : nextOffset);
    } catch (error) {
      if (error?.response?.status === 403) {
        handleForbidden();
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFeedback(0);
  }, []);

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = total === 0 ? 0 : Math.min(offset + items.length, total);
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;
  const pageSummary = useMemo(() => `第 ${pageStart}-${pageEnd} 条，共 ${total} 条`, [pageStart, pageEnd, total]);

  return (
    <div className="w-full">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-amber-500/10 rounded-2xl">
                <MessageSquareText className="w-8 h-8 text-amber-600" />
              </div>
              <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                用户反馈
              </h1>
            </div>
            <p className="text-slate-500 font-medium ml-1">查看用户从 Banner 和问卷完成页提交的反馈内容。</p>
          </div>

          <button
            type="button"
            onClick={() => fetchFeedback(offset, true)}
            disabled={loading || refreshing}
            className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-amber-300 hover:bg-amber-50/40 text-slate-700 font-semibold shadow-sm transition disabled:opacity-50 inline-flex items-center gap-2"
          >
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            刷新
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
            <p className="text-sm font-semibold text-slate-500">{pageSummary}</p>
            <div className="inline-flex gap-2">
              <button
                type="button"
                disabled={!canPrev || loading}
                onClick={() => fetchFeedback(Math.max(0, offset - PAGE_SIZE))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50"
              >
                上一页
              </button>
              <button
                type="button"
                disabled={!canNext || loading}
                onClick={() => fetchFeedback(offset + PAGE_SIZE)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50"
              >
                下一页
              </button>
            </div>
          </div>

          {loading ? (
            <div className="h-56 flex items-center justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
            </div>
          ) : items.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-slate-400">暂无反馈数据</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((item) => (
                <div key={item.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                      #{item.id}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                      {item.source || 'other'}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                      {item.is_guest ? '游客' : `用户 #${item.user_id || '--'}`}
                    </span>
                    {item.rose_code ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700">
                        ROSE: {item.rose_code}
                      </span>
                    ) : null}
                    <span className="text-xs text-slate-400 ml-auto">{formatFeedbackTime(item.created_at)}</span>
                  </div>
                  <p className="text-slate-700 whitespace-pre-wrap break-words leading-7">{item.content}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    联系邮箱：{item.contact_email || '--'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminFeedback;
