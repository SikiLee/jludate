import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Save, LayoutTemplate, FileText, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';

function AdminRoseTypes() {
  const navigate = useNavigate();
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [detail, setDetail] = useState(null);

  const handleForbidden = () => {
    toast.error('仅管理员可访问');
    navigate('/survey', { replace: true });
  };

  const fetchList = async () => {
    setListLoading(true);
    try {
      const res = await api.get('/admin/rose-types');
      const nextItems = Array.isArray(res.data?.data) ? res.data.data : [];
      setItems(nextItems);

      if (!selectedCode && nextItems.length > 0) {
        setSelectedCode(nextItems[0].rose_code);
      } else if (selectedCode && !nextItems.some((item) => item.rose_code === selectedCode)) {
        setSelectedCode(nextItems.length > 0 ? nextItems[0].rose_code : '');
      }
    } catch (error) {
      if (error?.response?.status === 403) {
        handleForbidden();
        return;
      }
    } finally {
      setListLoading(false);
    }
  };

  const fetchDetail = async (roseCode) => {
    if (!roseCode) {
      setDetail(null);
      return;
    }

    setDetailLoading(true);
    try {
      const res = await api.get(`/admin/rose-types/${roseCode}`);
      setDetail(res.data?.data || null);
    } catch (error) {
      if (error?.response?.status === 403) {
        handleForbidden();
        return;
      }
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  useEffect(() => {
    if (selectedCode) {
      fetchDetail(selectedCode);
    }
  }, [selectedCode]);

  const handleSave = async () => {
    if (!detail) {
      return;
    }

    const payload = {
      rose_name: detail.rose_name || '',
      enabled: Boolean(detail.enabled),
      markdown_content: detail.markdown_content || ''
    };

    setSaving(true);
    try {
      await api.put(`/admin/rose-types/${selectedCode}`, payload);
      toast.success('已保存修改！');
      await fetchList();
      await fetchDetail(selectedCode);
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

  return (
    <div className="w-full">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-indigo-500/10 rounded-2xl">
                <LayoutTemplate className="w-8 h-8 text-indigo-600" />
              </div>
              <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                ROSE 解读管理
              </h1>
            </div>
            <p className="text-slate-500 font-medium ml-1">管理并实时预览您的测算结果解读模板。修改后保存即生效。</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !detail}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold shadow-lg shadow-indigo-500/25 transition-all duration-300 disabled:opacity-50 flex items-center gap-2 hover:-translate-y-0.5"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              保存更改
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40 overflow-hidden flex flex-col md:flex-row min-h-[70vh]">
          {/* Sidebar */}
          <aside className="w-full md:w-80 border-r border-slate-100 bg-slate-50/30 flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-2 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
              <Activity className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-bold text-slate-600 tracking-wider">测算类型列表</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {listLoading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">暂无数据</div>
              ) : (
                items.map((item) => {
                  const active = selectedCode === item.rose_code;
                  return (
                    <button
                      key={item.rose_code}
                      onClick={() => setSelectedCode(item.rose_code)}
                      className={`w-full text-left p-4 rounded-2xl transition-all duration-300 relative group overflow-hidden ${
                        active 
                          ? 'bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 shadow-sm' 
                          : 'bg-white border border-transparent hover:border-slate-200 hover:shadow-sm hover:bg-slate-50'
                      }`}
                    >
                      {active && (
                        <motion.div 
                          layoutId="activeIndicator" 
                          className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-violet-500"
                        />
                      )}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className={`font-bold truncate transition-colors ${active ? 'text-indigo-900' : 'text-slate-800 group-hover:text-indigo-600'}`}>
                            {item.rose_code}
                          </h3>
                          <p className={`text-xs mt-1 truncate ${active ? 'text-indigo-600/70' : 'text-slate-500'}`}>
                            {item.rose_name || '未命名类型'}
                          </p>
                        </div>
                        <div className={`shrink-0 w-2.5 h-2.5 rounded-full mt-1.5 transition-all ${item.enabled ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-slate-300'}`} title={item.enabled ? '已启用' : '已禁用'} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Main Editor */}
          <main className="flex-1 bg-white relative">
            {detailLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10 transition-all">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            ) : null}

            <AnimatePresence mode="wait">
              {detail ? (
                <motion.div
                  key={detail.rose_code}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="p-6 md:p-10 max-w-4xl mx-auto h-full flex flex-col"
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100 shadow-sm">
                      <FileText className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900">{detail.rose_code} 详情配置</h2>
                      <p className="text-sm text-slate-500 mt-0.5">在此修改相关的分类标题和完整解析</p>
                    </div>
                  </div>

                  <div className="space-y-6 flex-grow flex flex-col">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Name Input */}
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">类型名称</label>
                        <input
                          type="text"
                          value={detail.rose_name || ''}
                          onChange={(e) => setDetail((prev) => ({ ...prev, rose_name: e.target.value }))}
                          placeholder="例如：独角兽型..."
                          className="w-full px-4 py-3.5 rounded-xl bg-slate-50/80 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-slate-800 font-medium placeholder:text-slate-400 shadow-sm"
                        />
                      </div>

                      {/* Switch */}
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">开放状态</label>
                        <div className="h-[52px] px-4 rounded-xl border border-slate-200 bg-slate-50/80 flex items-center shadow-sm">
                          <label className="relative inline-flex items-center cursor-pointer group w-full">
                            <input
                              type="checkbox"
                              checked={Boolean(detail.enabled)}
                              onChange={(e) => setDetail((prev) => ({ ...prev, enabled: e.target.checked }))}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                            <span className="ml-3 text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors">
                              {detail.enabled ? '对用户侧展示 (已启用)' : '隐藏此类型 (未启用)'}
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Markdown Area */}
                    <div className="flex-grow flex flex-col pt-4">
                      <div className="flex items-center justify-between ml-1 mb-2">
                         <label className="text-sm font-bold text-slate-700">Markdown 内容</label>
                         <span className="text-[11px] font-medium text-slate-500 bg-slate-100/80 border border-slate-200 px-2 py-0.5 rounded-md">
                           支持标准 Markdown 语法
                         </span>
                      </div>
                      <textarea
                        value={detail.markdown_content || ''}
                        onChange={(e) => setDetail((prev) => ({ ...prev, markdown_content: e.target.value }))}
                        placeholder="在此输入图文排版丰富的结果详情..."
                        className="w-full flex-grow min-h-[400px] p-5 rounded-2xl bg-slate-50/80 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-mono text-sm leading-relaxed text-slate-700 resize-y shadow-inner scrollbar-thin scrollbar-thumb-slate-200"
                      />
                    </div>
                  </div>
                </motion.div>
              ) : !listLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 shadow-sm">
                    <FileText className="w-10 h-10 text-slate-300" />
                  </div>
                  <p className="font-medium text-slate-500 tracking-wide">请在左侧选择一个类型进行编辑即可</p>
                </div>
              ) : null}
            </AnimatePresence>
          </main>
        </div>
      </motion.div>
    </div>
  );
}

export default AdminRoseTypes;
