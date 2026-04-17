import React, { useEffect, useState } from 'react';
import { Loader2, PlayCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

function MetricCard({ label, value, helper }) {
  return (
    <div className="p-4 rounded-2xl border border-slate-200 bg-white">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-400">{helper}</p> : null}
    </div>
  );
}

function CategoryBreakdown({ title, data }) {
  const d = data || { love: 0, friend: 0, xinghua: 0 };
  return (
    <div className="p-4 rounded-2xl border border-slate-200 bg-white">
      <p className="text-xs text-slate-500">{title}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2">
          <p className="text-[11px] text-rose-500">恋爱</p>
          <p className="text-base font-black text-rose-700">{d.love ?? 0}</p>
        </div>
        <div className="rounded-xl bg-sky-50 border border-sky-100 px-3 py-2">
          <p className="text-[11px] text-sky-500">交友</p>
          <p className="text-base font-black text-sky-700">{d.friend ?? 0}</p>
        </div>
        <div className="rounded-xl bg-violet-50 border border-violet-100 px-3 py-2">
          <p className="text-[11px] text-violet-500">杏花</p>
          <p className="text-base font-black text-violet-700">{d.xinghua ?? 0}</p>
        </div>
      </div>
    </div>
  );
}

function FunnelCard({ title, colorClass, funnel }) {
  const f = funnel || {};
  return (
    <div className={`rounded-xl border px-3 py-2 text-sm ${colorClass}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1">候选两侧：{Number(f.left_participants || 0)} / {Number(f.right_participants || 0)}</p>
      <p>硬筛通过边：{Number(f.hard_filter_edges || 0)}</p>
      <p>阈值通过边：{Number(f.threshold_edges || 0)}</p>
    </div>
  );
}

function AdminMatchData() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [data, setData] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState({
    love: true,
    friend: true,
    xinghua: true
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/match/dashboard');
      setData(res.data?.data || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handlePreview = async () => {
    if (!window.confirm('确认执行一键假匹配（仅预演统计，不落库、不发邮件、不影响用户）？')) {
      return;
    }
    setPreviewing(true);
    try {
      const pre = await api.get('/admin/match/preview');
      const preview = pre.data?.data || null;
      setPreviewResult(preview);
      const predictedUsers = Number(preview?.total?.matched_users || 0);
      const predictedFilled = Number(preview?.total?.questionnaire_filled || 0);
      const predictedRate = predictedFilled > 0
        ? Math.round((predictedUsers / predictedFilled) * 1000) / 10
        : 0;
      toast.success(`假匹配完成：预计成功人数 ${predictedUsers}，预计成功率 ${predictedRate}%`);
    } finally {
      setPreviewing(false);
    }
  };

  const handleRun = async () => {
    const categories = Object.entries(selectedCategories)
      .filter(([, checked]) => checked)
      .map(([key]) => key);
    if (categories.length === 0) {
      toast.error('请至少选择一个匹配分类');
      return;
    }
    setRunning(true);
    try {
      const res = await api.post('/admin/match/dashboard', { categories });
      const payload = res.data?.data || {};
      toast.success(`匹配完成：成功人数 ${payload?.result?.matched_users || 0}，成功率 ${payload?.result?.success_rate || 0}%`);
      setRunDialogOpen(false);
      await load();
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const cycle = data?.cycle;
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-slate-900">匹配数据模块</h1>
          <p className="text-sm text-slate-500 mt-1">
            当前周按匹配周期定义：本次匹配开启后进入新周，直到下一次匹配开启。
          </p>
          <p className="text-xs text-slate-400 mt-1">
            当前周期：{cycle ? `#${cycle.id}（${new Date(cycle.started_at).toLocaleString('zh-CN')}）` : '暂无周期'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
          <button
            type="button"
            disabled={previewing || running}
            onClick={handlePreview}
            className="px-4 py-2.5 rounded-xl border border-violet-200 bg-white hover:bg-violet-50 text-violet-700 font-semibold inline-flex items-center gap-2 disabled:opacity-60"
          >
            {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            一键假匹配
          </button>
          <button
            type="button"
            disabled={running}
            onClick={() => setRunDialogOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold inline-flex items-center gap-2 disabled:opacity-60"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
            一键真匹配
          </button>
        </div>
      </div>

      {previewResult ? (
        <div className="mb-6 p-4 rounded-2xl border border-violet-200 bg-violet-50/70">
          <p className="text-sm font-bold text-violet-800">假匹配预演结果（最近一次）</p>
          <p className="mt-1 text-sm text-violet-700">
            问卷填写人数：{Number(previewResult?.total?.questionnaire_filled || 0)}，
            预计匹配成功人数：{Number(previewResult?.total?.matched_users || 0)}，
            预计成功率：
            {(() => {
              const f = Number(previewResult?.total?.questionnaire_filled || 0);
              const m = Number(previewResult?.total?.matched_users || 0);
              const r = f > 0 ? Math.round((m / f) * 1000) / 10 : 0;
              return `${r}%`;
            })()}
          </p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm">
              <p className="text-rose-600 font-semibold">恋爱问卷</p>
              <p className="text-rose-700">
                填写 {Number(previewResult?.love?.questionnaire_filled || 0)} / 成功 {Number(previewResult?.love?.matched_users || 0)}
              </p>
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm">
              <p className="text-sky-600 font-semibold">交友问卷</p>
              <p className="text-sky-700">
                填写 {Number(previewResult?.friend?.questionnaire_filled || 0)} / 成功 {Number(previewResult?.friend?.matched_users || 0)}
              </p>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm">
              <p className="text-violet-600 font-semibold">杏花问卷</p>
              <p className="text-violet-700">
                填写 {Number(previewResult?.xinghua?.questionnaire_filled || 0)} / 成功 {Number(previewResult?.xinghua?.matched_users || 0)}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
            <FunnelCard
              title="恋爱漏斗诊断"
              colorClass="border-rose-200 bg-rose-50 text-rose-700"
              funnel={previewResult?.love?.funnel}
            />
            <FunnelCard
              title="交友漏斗诊断"
              colorClass="border-sky-200 bg-sky-50 text-sky-700"
              funnel={previewResult?.friend?.funnel}
            />
            <FunnelCard
              title="杏花漏斗诊断"
              colorClass="border-violet-200 bg-violet-50 text-violet-700"
              funnel={previewResult?.xinghua?.funnel}
            />
          </div>
          <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            总漏斗：候选两侧 {Number(previewResult?.total?.funnel?.left_participants || 0)} / {Number(previewResult?.total?.funnel?.right_participants || 0)}，
            硬筛通过边 {Number(previewResult?.total?.funnel?.hard_filter_edges || 0)}，
            阈值通过边 {Number(previewResult?.total?.funnel?.threshold_edges || 0)}
          </div>
        </div>
      ) : null}

      {runDialogOpen ? (
        <div className="fixed inset-0 z-[120] bg-black/30 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">确认执行一键真匹配</h3>
              <p className="mt-1 text-xs text-slate-500">请选择要执行真匹配的分类（将落库并发邮件）。</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={selectedCategories.love}
                  onChange={(e) => setSelectedCategories((prev) => ({ ...prev, love: e.target.checked }))}
                />
                恋爱匹配
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={selectedCategories.friend}
                  onChange={(e) => setSelectedCategories((prev) => ({ ...prev, friend: e.target.checked }))}
                />
                交友匹配
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={selectedCategories.xinghua}
                  onChange={(e) => setSelectedCategories((prev) => ({ ...prev, xinghua: e.target.checked }))}
                />
                杏花匹配
              </label>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                onClick={() => setRunDialogOpen(false)}
                disabled={running}
              >
                取消
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-60"
                onClick={handleRun}
                disabled={running}
              >
                {running ? '执行中...' : '确认执行'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="网站累计点击人数" value={data?.cumulative_click_users ?? 0} />
        <MetricCard label="累计已注册人数" value={data?.registered_users ?? 0} />
        <MetricCard label="当前周网站点击人数" value={data?.current_cycle_click_users ?? 0} />
        <MetricCard label="当前周已注册人数" value={data?.current_cycle_registered_users ?? 0} />
        <MetricCard label="南岭杏花ti累计填写人数" value={data?.cumulative_xinghua_ti_submit_users ?? 0} />
        <MetricCard label="当前周问卷填写人数" value={data?.current_cycle_questionnaire_filled_users ?? 0} />
        <MetricCard label="当前周匹配成功人数" value={data?.current_cycle_matched_users ?? 0} />
        <MetricCard label="当前周匹配成功率" value={`${data?.current_cycle_match_success_rate ?? 0}%`} />
        <MetricCard label="当前周成功用户首进结果页人数" value={data?.current_cycle_first_result_page_view_users ?? 0} />
        <MetricCard label="当前周站内聊天单方发起人数" value={data?.current_cycle_chat_one_side_initiated_users ?? 0} />
        <MetricCard label="当前周站内聊天双方发起人数" value={data?.current_cycle_chat_both_sides_initiated_users ?? 0} />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CategoryBreakdown
          title="当前周问卷填写人数（按问卷）"
          data={data?.current_cycle_questionnaire_filled_users_by_category}
        />
        <CategoryBreakdown
          title="当前周匹配成功人数（按问卷）"
          data={data?.current_cycle_matched_users_by_category}
        />
        <CategoryBreakdown
          title="当前周首进结果页人数（按问卷）"
          data={data?.current_cycle_first_result_page_view_users_by_category}
        />
      </div>

      <div className="mt-8 bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-black text-slate-900">最近匹配周期趋势</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">周期</th>
                <th className="text-left px-4 py-3 font-semibold">开始时间</th>
                <th className="text-right px-4 py-3 font-semibold">填写人数</th>
                <th className="text-right px-4 py-3 font-semibold">成功人数</th>
                <th className="text-right px-4 py-3 font-semibold">成功率</th>
                <th className="text-right px-4 py-3 font-semibold">首进结果页</th>
                <th className="text-right px-4 py-3 font-semibold">聊天单方</th>
                <th className="text-right px-4 py-3 font-semibold">聊天双方</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent_cycles || []).map((it) => (
                <tr key={it.cycle_id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-700">#{it.cycle_id}</td>
                  <td className="px-4 py-3 text-slate-700">{new Date(it.started_at).toLocaleString('zh-CN')}</td>
                  <td className="px-4 py-3 text-right text-slate-900 font-semibold">{it.questionnaire_filled_users}</td>
                  <td className="px-4 py-3 text-right text-slate-900 font-semibold">{it.matched_users}</td>
                  <td className="px-4 py-3 text-right text-slate-900 font-semibold">{it.success_rate}%</td>
                  <td className="px-4 py-3 text-right text-slate-700">{it.first_view_users}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{it.chat_one_side_users}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{it.chat_both_sides_users}</td>
                </tr>
              ))}
              {!data?.recent_cycles?.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">暂无周期数据</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminMatchData;

