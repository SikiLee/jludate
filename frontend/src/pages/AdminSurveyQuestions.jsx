import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, Save, HelpCircle, Activity, LayoutTemplate, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';

function AdminSurveyQuestions() {
  const navigate = useNavigate();
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [items, setItems] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [detail, setDetail] = useState(null);

  const handleForbidden = () => {
    toast.error('仅管理员可访问');
    navigate('/survey', { replace: true });
  };

  const fetchList = async () => {
    setListLoading(true);
    try {
      const res = await api.get('/admin/survey-questions');
      const rows = Array.isArray(res.data?.data) ? res.data.data : [];
      setItems(rows);

      if (!selectedNumber && rows.length > 0) {
        setSelectedNumber(rows[0].question_number);
      } else if (selectedNumber && !rows.some((item) => item.question_number === selectedNumber)) {
        setSelectedNumber(rows.length > 0 ? rows[0].question_number : null);
      }
    } catch (error) {
      if (error?.response?.status === 403) {
        handleForbidden();
      }
    } finally {
      setListLoading(false);
    }
  };

  const fetchDetail = async (questionNumber) => {
    if (!questionNumber) {
      setDetail(null);
      return;
    }

    setDetailLoading(true);
    try {
      const res = await api.get(`/admin/survey-questions/${questionNumber}`);
      setDetail(res.data?.data || null);
    } catch (error) {
      if (error?.response?.status === 403) {
        handleForbidden();
      } else {
        setDetail(null);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  useEffect(() => {
    if (selectedNumber) {
      fetchDetail(selectedNumber);
    }
  }, [selectedNumber]);

  const handleSave = async () => {
    if (!detail || !selectedNumber) {
      return;
    }

    setSaving(true);
    try {
      await api.put(`/admin/survey-questions/${selectedNumber}`, {
        section_title: detail.section_title || '',
        question_text: detail.question_text || '',
        display_order: Number(detail.display_order) || selectedNumber
      });
      toast.success('已保存修改！');
      await fetchList();
      await fetchDetail(selectedNumber);
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

  const handleImport = async () => {
    if (!window.confirm('将按默认题库重导。已存在题目会被覆盖。是否继续？')) {
      return;
    }

    setImporting(true);
    try {
      const res = await api.post('/admin/survey-questions/import', { overwrite: true });
      const result = res.data?.data || {};
      toast.success(`导入完成：新增 ${result.inserted || 0}，更新 ${result.updated || 0}`);
      await fetchList();
      if (selectedNumber) {
        await fetchDetail(selectedNumber);
      }
    } catch (error) {
      if (error?.response?.status === 403) {
        handleForbidden();
      } else {
        toast.error('导入失败');
      }
    } finally {
      setImporting(false);
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
              <div className="p-3 bg-violet-500/10 rounded-2xl">
                <HelpCircle className="w-8 h-8 text-violet-600" />
              </div>
              <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                问卷题目配置
              </h1>
            </div>
            <p className="text-slate-500 font-medium ml-1">管理测算问题的文案、分组与显示顺序，修改后立即在用户端生效。</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-violet-300 hover:bg-violet-50/50 text-slate-700 font-semibold shadow-sm transition-all duration-300 disabled:opacity-50 flex items-center gap-2 hover:-translate-y-0.5"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              重导默认题库
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !detail}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold shadow-lg shadow-violet-500/25 transition-all duration-300 disabled:opacity-50 flex items-center gap-2 hover:-translate-y-0.5"
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
              <span className="text-sm font-bold text-slate-600 tracking-wider">题目列表</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[70vh]">
              {listLoading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">暂无数据</div>
              ) : (
                items.map((item) => {
                  const active = selectedNumber === item.question_number;
                  return (
                    <button
                      key={item.question_number}
                      onClick={() => setSelectedNumber(item.question_number)}
                      className={`w-full text-left p-4 rounded-2xl transition-all duration-300 relative group overflow-hidden ${
                        active 
                          ? 'bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-100 shadow-sm' 
                          : 'bg-white border border-transparent hover:border-slate-200 hover:shadow-sm hover:bg-slate-50'
                      }`}
                    >
                      {active && (
                        <motion.div 
                          layoutId="activeIndicatorSurvey" 
                          className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 to-fuchsia-500"
                        />
                      )}
                      <div>
                        <div className="flex items-baseline gap-2">
                           <h3 className={`font-black text-lg ${active ? 'text-violet-900' : 'text-slate-800 group-hover:text-violet-600'}`}>
                             Q{item.question_number}
                           </h3>
                        </div>
                        <p className={`text-xs mt-1 truncate ${active ? 'text-violet-600/80' : 'text-slate-500'}`}>
                          {item.section_title || '未分组'}
                        </p>
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
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
              </div>
            ) : null}

            <AnimatePresence mode="wait">
              {detail ? (
                <motion.div
                  key={detail.question_number}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="p-6 md:p-10 max-w-4xl mx-auto h-full flex flex-col"
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center shrink-0 border border-violet-100 shadow-sm">
                      <FileText className="w-6 h-6 text-violet-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900">第 {detail.question_number} 题 配置</h2>
                      <p className="text-sm text-slate-500 mt-0.5">在此修改此题目的具体文案以及展示顺序</p>
                    </div>
                  </div>

                  <div className="space-y-6 flex-grow flex flex-col">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Section Title */}
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">分组标题</label>
                        <input
                          type="text"
                          value={detail.section_title || ''}
                          onChange={(e) => setDetail((prev) => ({ ...prev, section_title: e.target.value }))}
                          placeholder="例如：第一部分 或 个人信息"
                          className="w-full px-4 py-3.5 rounded-xl bg-slate-50/80 border border-slate-200 focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all text-slate-800 font-medium placeholder:text-slate-400 shadow-sm"
                        />
                      </div>

                      {/* Display Order */}
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">显示顺序</label>
                        <div className="relative">
                          <input
                            type="number"
                            min={1}
                            value={detail.display_order || detail.question_number}
                            onChange={(e) => setDetail((prev) => ({ ...prev, display_order: Number(e.target.value) }))}
                            className="w-full px-4 py-3.5 rounded-xl bg-slate-50/80 border border-slate-200 focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all text-slate-800 font-medium shadow-sm"
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                            从小到大排列
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Question Text Area */}
                    <div className="flex-grow flex flex-col pt-4">
                      <div className="flex items-center justify-between ml-1 mb-2">
                         <label className="text-sm font-bold text-slate-700">题目正文</label>
                         <span className="text-[11px] font-medium text-slate-500 bg-slate-100/80 border border-slate-200 px-2 py-0.5 rounded-md">
                           供用户阅读的具体问题文案
                         </span>
                      </div>
                      <textarea
                        value={detail.question_text || ''}
                        onChange={(e) => setDetail((prev) => ({ ...prev, question_text: e.target.value }))}
                        placeholder="请输入题干内容..."
                        className="w-full flex-grow min-h-[300px] p-5 rounded-2xl bg-slate-50/80 border border-slate-200 focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all text-lg leading-relaxed text-slate-700 resize-y shadow-inner scrollbar-thin scrollbar-thumb-slate-200"
                      />
                    </div>
                  </div>
                </motion.div>
              ) : !listLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 shadow-sm">
                    <HelpCircle className="w-10 h-10 text-slate-300" />
                  </div>
                  <p className="font-medium text-slate-500 tracking-wide">请在左侧选择一个题号进行编辑即可</p>
                </div>
              ) : null}
            </AnimatePresence>
          </main>
        </div>
      </motion.div>
    </div>
  );
}

export default AdminSurveyQuestions;
