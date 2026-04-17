import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, Save, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../api';

function safeJsonParse(value) {
  try {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return {};
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function AdminMatchQuestionnaire() {
  const navigate = useNavigate();
  const [type, setType] = useState('love');
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [busy, setBusy] = useState(false);

  const [editingItem, setEditingItem] = useState(null); // raw item
  const [editor, setEditor] = useState({
    page_key: '',
    module_index: 0,
    question_kind: '',
    question_number: 1,
    display_order: 1,
    question_title: '',
    question_stem: '',
    left_option_text: '',
    right_option_text: '',
    options_json_text: '{}'
  });

  // Add forms (minimal but functional)
  const [addDeepOpen, setAddDeepOpen] = useState(false);
  const [addDeep, setAddDeep] = useState({
    module_index: 1,
    question_number: 37,
    question_title: '',
    question_stem: '',
    left_option_text: '',
    right_option_text: '',
    display_order: 37
  });

  const [addHardSettingsOpen, setAddHardSettingsOpen] = useState(false);
  const [addHardSettings, setAddHardSettings] = useState({
    page_key: 'hard', // or settings
    question_kind: 'select',
    question_number: 37,
    question_title: '',
    question_stem: '',
    left_option_text: '',
    right_option_text: '',
    options_json_text: '{}',
    display_order: 37
  });

  const handleForbidden = () => {
    toast.error('仅管理员可访问');
    navigate('/survey', { replace: true });
  };

  const fetchConfig = async (nextType) => {
    setLoading(true);
    try {
      const res = await api.get('/admin/match-questionnaire/config', {
        params: { type: nextType }
      });
      setConfig(res.data?.data || null);
    } catch (e) {
      if (e?.response?.status === 403) handleForbidden();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig(type);
  }, [type]);

  const deepModules = config?.deep_modules || [];
  const hardItems = config?.hard_items || [];
  const settingsItems = config?.settings_items || [];

  const flattenedDeepItems = useMemo(() => {
    const list = [];
    for (const m of deepModules) {
      for (const q of m.questions || []) list.push(q);
    }
    return list;
  }, [deepModules]);

  const startEdit = (item) => {
    setEditingItem(item);
    setEditor({
      page_key: item.page_key || (item.module_index ? 'deep' : ''),
      module_index: typeof item.module_index === 'number' ? item.module_index : 0,
      question_kind: item.question_kind || '',
      question_number: item.question_number || 1,
      display_order: item.display_order || item.question_number || 1,
      question_title: item.question_title || '',
      question_stem: item.question_stem || '',
      left_option_text: item.left_option_text || '',
      right_option_text: item.right_option_text || '',
      options_json_text: JSON.stringify(item.options_json || {}, null, 2)
    });
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    const parsedOptions = safeJsonParse(editor.options_json_text);
    if (parsedOptions === null) {
      toast.error('options_json 不是有效 JSON');
      return;
    }
    setBusy(true);
    try {
      await api.put(
        `/admin/match-questionnaire/items/${editingItem.id}`,
        {
          payload: {
          page_key: editor.page_key || editingItem.page_key,
          module_index: editor.module_index,
          question_kind: editor.question_kind,
          question_number: Number(editor.question_number),
          display_order: Number(editor.display_order),
          question_title: editor.question_title,
          question_stem: editor.question_stem,
          left_option_text: editor.left_option_text,
          right_option_text: editor.right_option_text,
          options_json: parsedOptions
          }
        },
        { params: { type } }
      );
      toast.success('保存成功');
      await fetchConfig(type);
      setEditingItem(null);
    } catch (e) {
      if (e?.response?.status === 403) handleForbidden();
      else toast.error('保存失败');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm('确认删除该题目？')) return;
    setBusy(true);
    try {
      await api.delete(`/admin/match-questionnaire/items/${item.id}`, {
        params: { type }
      });
      toast.success('删除成功');
      await fetchConfig(type);
    } catch (e) {
      if (e?.response?.status === 403) handleForbidden();
      else toast.error('删除失败');
    } finally {
      setBusy(false);
    }
  };

  const handleReorder = async ({ pageKey, moduleIndex, items }) => {
    // items: array sorted in desired order
    const payloadItems = items.map((it, idx) => ({
      id: it.id,
      display_order: idx + 1
    }));

    setBusy(true);
    try {
      await api.post('/admin/match-questionnaire/reorder', {
        questionnaire_type: type,
        payload: {
          items: payloadItems
        }
      });
      await fetchConfig(type);
      toast.success('顺序已更新');
    } catch (e) {
      if (e?.response?.status === 403) handleForbidden();
      else toast.error('更新顺序失败');
    } finally {
      setBusy(false);
    }
  };

  const MoveButtons = ({ list, onMoveUp, onMoveDown }) => (
    <div className="inline-flex items-center gap-2">
      {list ? (
        <>
          <button type="button" onClick={onMoveUp} className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50" disabled={busy}>
            <ArrowUp className="w-4 h-4 text-slate-500" />
          </button>
          <button type="button" onClick={onMoveDown} className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50" disabled={busy}>
            <ArrowDown className="w-4 h-4 text-slate-500" />
          </button>
        </>
      ) : null}
    </div>
  );

  const renderItemCard = (item, { list, onMoveUp, onMoveDown }) => (
    <div key={`item-${item.id}`} className="border border-slate-200 rounded-2xl bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900 truncate">
            第 {item.question_number} 题：{item.question_title || '（无标题）'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {item.page_key || 'deep'} {typeof item.module_index === 'number' ? `- 模块 ${item.module_index}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MoveButtons list={list} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
          <button
            type="button"
            onClick={() => startEdit(item)}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-2"
            disabled={busy}
          >
            <Save className="w-4 h-4" />
            编辑
          </button>
          <button
            type="button"
            onClick={() => handleDeleteItem(item)}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-2"
            disabled={busy}
          >
            <Trash2 className="w-4 h-4" />
            删除
          </button>
        </div>
      </div>

      {item.question_stem ? (
        <p className="text-xs text-slate-600 whitespace-pre-wrap">{item.question_stem}</p>
      ) : null}
    </div>
  );

  const reorderBySwap = (currentList, item, direction) => {
    const idx = currentList.findIndex((x) => x.id === item.id);
    if (idx < 0) return currentList;
    const next = [...currentList];
    const otherIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (otherIdx < 0 || otherIdx >= next.length) return currentList;
    const tmp = next[otherIdx];
    next[otherIdx] = next[idx];
    next[idx] = tmp;
    return next;
  };

  const sections = (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-5">
        <div className="bg-white/60 border border-slate-200 rounded-3xl p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black text-slate-900">匹配问卷配置</h3>
            <div className="flex items-center gap-2">
              <select value={type} onChange={(e) => setType(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold">
                <option value="love">恋爱</option>
                <option value="friend">交友</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">修改题目文案后用户端将立即生效。</p>
        </div>

        <div className="bg-white/60 border border-slate-200 rounded-3xl p-5 space-y-3">
          <h4 className="text-sm font-black text-slate-900">提示</h4>
          <p className="text-xs text-slate-600 leading-5">
            你可以编辑题干与左右选项、删除题目、并通过上/下按钮调整显示顺序。
          </p>
        </div>

        {editingItem ? (
          <div className="bg-white/60 border border-slate-200 rounded-3xl p-5 space-y-4">
            <h4 className="text-sm font-black text-slate-900">编辑模式</h4>
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-600">题目标题</label>
              <input value={editor.question_title} onChange={(e) => setEditor((p) => ({ ...p, question_title: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700" />
              <label className="text-xs font-semibold text-slate-600">题干</label>
              <textarea value={editor.question_stem} onChange={(e) => setEditor((p) => ({ ...p, question_stem: e.target.value }))} className="w-full min-h-[90px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 resize-y" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">左选项</label>
                  <input value={editor.left_option_text} onChange={(e) => setEditor((p) => ({ ...p, left_option_text: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">右选项</label>
                  <input value={editor.right_option_text} onChange={(e) => setEditor((p) => ({ ...p, right_option_text: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">options_json（JSON）</label>
                <textarea value={editor.options_json_text} onChange={(e) => setEditor((p) => ({ ...p, options_json_text: e.target.value }))} className="w-full min-h-[110px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-mono text-xs resize-y" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={handleSaveEdit} disabled={busy} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold disabled:opacity-50 flex items-center gap-2 justify-center">
                  <Save className="w-4 h-4" />
                  保存
                </button>
                <button type="button" onClick={() => setEditingItem(null)} disabled={busy} className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-50">
                  取消
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="lg:col-span-2 space-y-8">
        <div className="bg-white/60 border border-slate-200 rounded-3xl p-5">
          <h4 className="text-sm font-black text-slate-900 mb-3">硬筛选（Hard）</h4>
          {hardItems.map((it, idx) => {
            const list = hardItems;
            const onMoveUp = () => {
              const next = reorderBySwap(list, it, 'up');
              handleReorder({ pageKey: 'hard', moduleIndex: 0, items: next });
            };
            const onMoveDown = () => {
              const next = reorderBySwap(list, it, 'down');
              handleReorder({ pageKey: 'hard', moduleIndex: 0, items: next });
            };
            return renderItemCard(it, { list, onMoveUp, onMoveDown });
          })}

          <div className="mt-5">
            <button
              type="button"
              onClick={() => setAddHardSettingsOpen((v) => !v)}
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold flex items-center justify-center gap-2"
              disabled={busy}
            >
              新增硬筛选题目
            </button>
            {addHardSettingsOpen ? (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">题号</label>
                    <input type="number" value={addHardSettings.question_number} onChange={(e) => setAddHardSettings((p) => ({ ...p, question_number: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">显示顺序</label>
                    <input type="number" value={addHardSettings.display_order} onChange={(e) => setAddHardSettings((p) => ({ ...p, display_order: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">题目类型</label>
                    <select value={addHardSettings.question_kind} onChange={(e) => setAddHardSettings((p) => ({ ...p, question_kind: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold">
                      <option value="select">select</option>
                      <option value="toggle">toggle</option>
                      <option value="text">text</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">题目标题</label>
                    <input value={addHardSettings.question_title} onChange={(e) => setAddHardSettings((p) => ({ ...p, question_title: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700" />
                  </div>
                </div>
                <label className="text-xs font-semibold text-slate-600">题干</label>
                <textarea value={addHardSettings.question_stem} onChange={(e) => setAddHardSettings((p) => ({ ...p, question_stem: e.target.value }))} className="w-full min-h-[70px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 resize-y" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">左选项文案</label>
                    <input value={addHardSettings.left_option_text} onChange={(e) => setAddHardSettings((p) => ({ ...p, left_option_text: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">右选项文案</label>
                    <input value={addHardSettings.right_option_text} onChange={(e) => setAddHardSettings((p) => ({ ...p, right_option_text: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700" />
                  </div>
                </div>
                <label className="text-xs font-semibold text-slate-600">options_json（JSON）</label>
                <textarea value={addHardSettings.options_json_text} onChange={(e) => setAddHardSettings((p) => ({ ...p, options_json_text: e.target.value }))} className="w-full min-h-[90px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-mono text-xs resize-y" />
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      const parsed = safeJsonParse(addHardSettings.options_json_text);
                      if (parsed === null) {
                        toast.error('options_json 不是有效 JSON');
                        return;
                      }
                      setBusy(true);
                      try {
                        await api.post('/admin/match-questionnaire/items', {
                          questionnaire_type: type,
                          payload: {
                            page_key: 'hard',
                            module_index: 0,
                            question_kind: addHardSettings.question_kind,
                            question_number: Number(addHardSettings.question_number),
                            display_order: Number(addHardSettings.display_order),
                            question_title: addHardSettings.question_title,
                            question_stem: addHardSettings.question_stem,
                            left_option_text: addHardSettings.left_option_text,
                            right_option_text: addHardSettings.right_option_text,
                            options_json: parsed
                          }
                        });
                        toast.success('新增成功');
                        setAddHardSettingsOpen(false);
                        await fetchConfig(type);
                      } catch (e) {
                        if (e?.response?.status === 403) handleForbidden();
                        else toast.error('新增失败');
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold disabled:opacity-50"
                  >
                    保存新增
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setAddHardSettingsOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-50"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="bg-white/60 border border-slate-200 rounded-3xl p-5">
          <h4 className="text-sm font-black text-slate-900 mb-3">深度问卷（Deep，按模块）</h4>
          {deepModules.map((m) => (
            <div key={`module-${m.module_index}`} className="mb-7 last:mb-0">
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <h5 className="text-sm font-black text-slate-900">
                  模块 {m.module_index}：{m.title}
                </h5>
                <p className="text-xs text-slate-500">{(m.questions || []).length} 题</p>
              </div>
              <div className="space-y-4">
                {(m.questions || []).map((q) => {
                  const list = m.questions || [];
                  const onMoveUp = () => {
                    const next = reorderBySwap(list, q, 'up');
                    handleReorder({ pageKey: 'deep', moduleIndex: m.module_index, items: next });
                  };
                  const onMoveDown = () => {
                    const next = reorderBySwap(list, q, 'down');
                    handleReorder({ pageKey: 'deep', moduleIndex: m.module_index, items: next });
                  };
                  return renderItemCard(q, { list, onMoveUp, onMoveDown });
                })}
              </div>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => {
                    setAddDeepOpen(true);
                    setAddDeep((p) => ({ ...p, module_index: m.module_index }));
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold flex items-center justify-center gap-2"
                  disabled={busy}
                >
                  新增模块 {m.module_index} 题目
                </button>
              </div>

              {addDeepOpen && addDeep.module_index === m.module_index ? (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600">题号</label>
                      <input type="number" value={addDeep.question_number} onChange={(e) => setAddDeep((p) => ({ ...p, question_number: Number(e.target.value), display_order: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">显示顺序</label>
                      <input type="number" value={addDeep.display_order} onChange={(e) => setAddDeep((p) => ({ ...p, display_order: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700" />
                    </div>
                  </div>
                  <label className="text-xs font-semibold text-slate-600">题目标题（名称）</label>
                  <input value={addDeep.question_title} onChange={(e) => setAddDeep((p) => ({ ...p, question_title: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700" />
                  <label className="text-xs font-semibold text-slate-600">题干</label>
                  <textarea value={addDeep.question_stem} onChange={(e) => setAddDeep((p) => ({ ...p, question_stem: e.target.value }))} className="w-full min-h-[70px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 resize-y" />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600">左选项</label>
                      <input value={addDeep.left_option_text} onChange={(e) => setAddDeep((p) => ({ ...p, left_option_text: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">右选项</label>
                      <input value={addDeep.right_option_text} onChange={(e) => setAddDeep((p) => ({ ...p, right_option_text: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api.post('/admin/match-questionnaire/items', {
                            questionnaire_type: type,
                            payload: {
                              page_key: 'deep',
                              module_index: addDeep.module_index,
                              question_kind: 'scale5_lr',
                              question_number: Number(addDeep.question_number),
                              display_order: Number(addDeep.display_order),
                              question_title: addDeep.question_title,
                              question_stem: addDeep.question_stem,
                              left_option_text: addDeep.left_option_text,
                              right_option_text: addDeep.right_option_text,
                              options_json: {}
                            }
                          });
                          toast.success('新增成功');
                          setAddDeepOpen(false);
                          await fetchConfig(type);
                        } catch (e) {
                          if (e?.response?.status === 403) handleForbidden();
                          else toast.error('新增失败');
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold disabled:opacity-50"
                    >
                      保存新增
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setAddDeepOpen(false)}
                      className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-50"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="bg-white/60 border border-slate-200 rounded-3xl p-5">
          <h4 className="text-sm font-black text-slate-900 mb-3">匹配设置（Settings）</h4>
          {settingsItems.map((it) => {
            const list = settingsItems;
            const onMoveUp = () => {
              const next = reorderBySwap(list, it, 'up');
              handleReorder({ pageKey: 'settings', moduleIndex: 0, items: next });
            };
            const onMoveDown = () => {
              const next = reorderBySwap(list, it, 'down');
              handleReorder({ pageKey: 'settings', moduleIndex: 0, items: next });
            };
            return renderItemCard(it, { list, onMoveUp, onMoveDown });
          })}

          <div className="mt-5">
            <button
              type="button"
              onClick={() => {
                setAddHardSettingsOpen((v) => !v);
                setAddHardSettings((p) => ({ ...p, page_key: 'settings' }));
              }}
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold flex items-center justify-center gap-2"
              disabled={busy}
            >
              新增匹配设置题目
            </button>
            {addHardSettingsOpen ? (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">题号</label>
                    <input type="number" value={addHardSettings.question_number} onChange={(e) => setAddHardSettings((p) => ({ ...p, question_number: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">显示顺序</label>
                    <input type="number" value={addHardSettings.display_order} onChange={(e) => setAddHardSettings((p) => ({ ...p, display_order: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">题目类型</label>
                    <select value={addHardSettings.question_kind} onChange={(e) => setAddHardSettings((p) => ({ ...p, question_kind: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold">
                      <option value="select">select</option>
                      <option value="toggle">toggle</option>
                      <option value="text">text</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">题目标题</label>
                    <input value={addHardSettings.question_title} onChange={(e) => setAddHardSettings((p) => ({ ...p, question_title: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700" />
                  </div>
                </div>
                <label className="text-xs font-semibold text-slate-600">题干</label>
                <textarea value={addHardSettings.question_stem} onChange={(e) => setAddHardSettings((p) => ({ ...p, question_stem: e.target.value }))} className="w-full min-h-[70px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 resize-y" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">左选项文案</label>
                    <input value={addHardSettings.left_option_text} onChange={(e) => setAddHardSettings((p) => ({ ...p, left_option_text: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">右选项文案</label>
                    <input value={addHardSettings.right_option_text} onChange={(e) => setAddHardSettings((p) => ({ ...p, right_option_text: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700" />
                  </div>
                </div>
                <label className="text-xs font-semibold text-slate-600">options_json（JSON）</label>
                <textarea value={addHardSettings.options_json_text} onChange={(e) => setAddHardSettings((p) => ({ ...p, options_json_text: e.target.value }))} className="w-full min-h-[90px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-mono text-xs resize-y" />
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      const parsed = safeJsonParse(addHardSettings.options_json_text);
                      if (parsed === null) {
                        toast.error('options_json 不是有效 JSON');
                        return;
                      }
                      setBusy(true);
                      try {
                        await api.post('/admin/match-questionnaire/items', {
                          questionnaire_type: type,
                          payload: {
                            page_key: 'settings',
                            module_index: 0,
                            question_kind: addHardSettings.question_kind,
                            question_number: Number(addHardSettings.question_number),
                            display_order: Number(addHardSettings.display_order),
                            question_title: addHardSettings.question_title,
                            question_stem: addHardSettings.question_stem,
                            left_option_text: addHardSettings.left_option_text,
                            right_option_text: addHardSettings.right_option_text,
                            options_json: parsed
                          }
                        });
                        toast.success('新增成功');
                        setAddHardSettingsOpen(false);
                        await fetchConfig(type);
                      } catch (e) {
                        if (e?.response?.status === 403) handleForbidden();
                        else toast.error('新增失败');
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold disabled:opacity-50"
                  >
                    保存新增
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setAddHardSettingsOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-50"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              匹配问卷配置中心
            </h1>
            <p className="text-slate-500 font-medium ml-1">支持管理员编辑题目、调整顺序并即时生效。</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-violet-500" />
          </div>
        ) : config ? (
          sections
        ) : (
          <div className="text-slate-500 text-center py-20">暂无配置数据</div>
        )}
      </motion.div>
    </div>
  );
}

export default AdminMatchQuestionnaire;

