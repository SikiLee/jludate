import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, Eye, Loader2, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import api from '../api';

function formatTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('zh-CN', { hour12: false });
}

function statusBadge(status) {
  const s = String(status || '');
  if (s === 'approved') return { label: '已通过', cls: 'bg-emerald-50 text-emerald-700' };
  if (s === 'rejected') return { label: '已拒绝', cls: 'bg-rose-50 text-rose-700' };
  return { label: '待审核', cls: 'bg-amber-50 text-amber-700' };
}

function AdminEmailExceptions() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);

  const [active, setActive] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [hasInvalidSendRecord, setHasInvalidSendRecord] = useState(null);
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [screenshotLoading, setScreenshotLoading] = useState(false);

  const handleForbidden = () => {
    toast.error('仅管理员可访问');
    navigate('/survey', { replace: true });
  };

  const fetchItems = async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get('/admin/email-exception/applications');
      setItems(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error) {
      if (error?.response?.status === 403) handleForbidden();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchItems(false);
  }, []);

  const pendingCount = useMemo(
    () => items.filter((x) => x.status === 'pending').length,
    [items]
  );

  const handleApproveAll = async () => {
    if (pendingCount <= 0) {
      toast('当前没有待审核申请');
      return;
    }
    if (!window.confirm(`确认一键通过全部待审核申请吗？当前待审核 ${pendingCount} 条。`)) {
      return;
    }
    setBulkApproving(true);
    try {
      const res = await api.post('/admin/email-exception/applications/approve-all');
      const approved = Number(res?.data?.data?.approved_count || 0);
      const skipped = Number(res?.data?.data?.skipped_count || 0);
      toast.success(`批量通过完成：通过 ${approved} 条，跳过 ${skipped} 条`);
      await fetchItems(true);
    } catch {
      // handled by interceptor
    } finally {
      setBulkApproving(false);
    }
  };

  const openReview = (row) => {
    setActive(row);
    setHasInvalidSendRecord(
      typeof row?.has_invalid_send_record === 'boolean' ? row.has_invalid_send_record : null
    );
  };

  const closeReview = () => {
    setActive(null);
    setHasInvalidSendRecord(null);
    if (screenshotUrl) {
      URL.revokeObjectURL(screenshotUrl);
    }
    setScreenshotUrl('');
  };

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    const shouldLoad = Boolean(active?.has_screenshot) && !Boolean(active?.screenshot_deleted);
    if (!shouldLoad) {
      setScreenshotUrl('');
      return undefined;
    }

    let cancelled = false;
    setScreenshotLoading(true);
    api.get(`/admin/email-exception/applications/${active.id}/screenshot`, {
      responseType: 'blob',
      skipAuthRedirect: true
    })
      .then((res) => {
        if (cancelled) return;
        const blob = res?.data instanceof Blob ? res.data : new Blob([res?.data]);
        const url = URL.createObjectURL(blob);
        setScreenshotUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      })
      .catch((error) => {
        if (cancelled) return;
        if (error?.response?.status === 401) {
          toast.error('登录已过期，请重新登录');
          navigate('/auth', { replace: true });
        } else {
          toast.error('截图加载失败');
        }
        setScreenshotUrl('');
      })
      .finally(() => {
        if (cancelled) return;
        setScreenshotLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [active?.id]);

  const submitReview = async (decision) => {
    if (!active?.id) return;
    setReviewing(true);
    try {
      await api.post(`/admin/email-exception/applications/${active.id}/review`, {
        decision,
        has_invalid_send_record: hasInvalidSendRecord
      });
      toast.success('审核已保存');
      closeReview();
      await fetchItems(true);
    } catch {
      // handled by interceptor
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="w-full">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-rose-500/10 rounded-2xl">
                <AlertTriangle className="w-8 h-8 text-rose-600" />
              </div>
              <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                异常校园邮箱审核
              </h1>
            </div>
            <p className="text-slate-500 font-medium ml-1">
              待审核 {pendingCount} 条。审核完成后系统会删除原图并清空路径。
            </p>
          </div>

          <button
            type="button"
            onClick={() => fetchItems(true)}
            disabled={loading || refreshing}
            className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-rose-300 hover:bg-rose-50/40 text-slate-700 font-semibold shadow-sm transition disabled:opacity-50 inline-flex items-center gap-2"
          >
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            刷新
          </button>
          <button
            type="button"
            onClick={handleApproveAll}
            disabled={loading || refreshing || bulkApproving || pendingCount <= 0}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm transition disabled:opacity-50 inline-flex items-center gap-2"
          >
            {bulkApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            一键全部通过
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40 overflow-hidden">
          {loading ? (
            <div className="h-56 flex items-center justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-rose-500" />
            </div>
          ) : items.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-slate-400">暂无申请</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((row) => {
                const badge = statusBadge(row.status);
                return (
                  <div key={row.id} className="px-6 py-5">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        #{row.id}
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <span className="text-xs text-slate-400 ml-auto">提交时间：{formatTime(row.created_at)}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                        <p className="text-slate-500 text-xs font-semibold mb-1">校园邮箱（账号标识）</p>
                        <p className="text-slate-800 font-bold break-all">{row.school_email}</p>
                      </div>
                      <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                        <p className="text-slate-500 text-xs font-semibold mb-1">备用邮箱（收验证码/匹配/通知）</p>
                        <p className="text-slate-800 font-bold break-all">{row.backup_email}</p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                        <p className="text-slate-500 text-xs font-semibold mb-1">备用邮箱已验证</p>
                        <p className="text-slate-800 font-bold">{row.backup_email_verified ? '是' : '否'}</p>
                      </div>
                      <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                        <p className="text-slate-500 text-xs font-semibold mb-1">无效发送记录已确认</p>
                        <p className="text-slate-800 font-bold">
                          {typeof row.has_invalid_send_record === 'boolean' ? (row.has_invalid_send_record ? '是' : '否') : '未标记'}
                        </p>
                      </div>
                      <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                        <p className="text-slate-500 text-xs font-semibold mb-1">原图状态</p>
                        <p className="text-slate-800 font-bold">
                          {row.screenshot_deleted ? '原图已删除' : row.has_screenshot ? '可预览' : '无'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openReview(row)}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold inline-flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        查看 / 审核
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {active ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-3xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/40 flex items-center justify-between sticky top-0 z-10">
              <div>
                <p className="text-sm font-bold text-slate-800">审核申请 #{active.id}</p>
                <p className="text-xs text-slate-500 mt-1">提交时间：{formatTime(active.created_at)}</p>
              </div>
              <button
                type="button"
                onClick={closeReview}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-white"
              >
                关闭
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60">
                  <p className="text-slate-500 text-xs font-semibold mb-1">校园邮箱</p>
                  <p className="text-slate-800 font-bold break-all">{active.school_email}</p>
                </div>
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60">
                  <p className="text-slate-500 text-xs font-semibold mb-1">备用邮箱</p>
                  <p className="text-slate-800 font-bold break-all">{active.backup_email}</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                <p className="text-slate-700 font-bold mb-2">学校邮箱登录截图</p>
                {active.screenshot_deleted ? (
                  <p className="text-sm text-slate-500">原图已删除</p>
                ) : active.has_screenshot ? (
                  <div className="rounded-2xl overflow-hidden border border-slate-200">
                    {screenshotLoading ? (
                      <div className="h-[240px] flex items-center justify-center bg-slate-50">
                        <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                      </div>
                    ) : screenshotUrl ? (
                      <img
                        src={screenshotUrl}
                        alt="screenshot"
                        className="w-full max-h-[70vh] object-contain bg-slate-50"
                      />
                    ) : (
                      <div className="h-[240px] flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
                        截图加载失败或已删除
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">无截图</p>
                )}
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-slate-700 font-bold">无效发送记录确认</p>
                    <p className="text-xs text-slate-500 mt-1">管理员人工标记：是否确实存在无效发送记录。</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setHasInvalidSendRecord(true)}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-semibold ${
                        hasInvalidSendRecord === true
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      是
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasInvalidSendRecord(false)}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-semibold ${
                        hasInvalidSendRecord === false
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      否
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasInvalidSendRecord(null)}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-semibold ${
                        hasInvalidSendRecord === null
                          ? 'border-slate-300 bg-slate-100 text-slate-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      未标记
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => submitReview('rejected')}
                  disabled={reviewing}
                  className="px-5 py-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold inline-flex items-center gap-2 disabled:opacity-60"
                >
                  {reviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  拒绝
                </button>
                <button
                  type="button"
                  onClick={() => submitReview('approved')}
                  disabled={reviewing}
                  className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold inline-flex items-center gap-2 disabled:opacity-60"
                >
                  {reviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  通过
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AdminEmailExceptions;

