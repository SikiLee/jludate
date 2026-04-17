import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import remarkBreaks from 'remark-breaks';
import api from '../api';

function RoseTypes() {
  const navigate = useNavigate();
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [detail, setDetail] = useState(null);

  const selectedItem = useMemo(
    () => items.find((item) => item.rose_code === selectedCode) || null,
    [items, selectedCode]
  );

  useEffect(() => {
    const fetchList = async () => {
      setListLoading(true);
      try {
        const res = await api.get('/public/rose-types', { skipAuthRedirect: true });
        const rows = Array.isArray(res.data?.data?.items) ? res.data.data.items : [];
        setItems(rows);
        setSelectedCode(rows[0]?.rose_code || '');
      } catch {
        setItems([]);
        setSelectedCode('');
      } finally {
        setListLoading(false);
      }
    };

    fetchList();
  }, []);

  useEffect(() => {
    if (!selectedCode) {
      setDetail(null);
      return;
    }

    const fetchDetail = async () => {
      setDetailLoading(true);
      try {
        const res = await api.get(`/public/rose-types/${selectedCode}`, { skipAuthRedirect: true });
        setDetail(res.data?.data || null);
      } catch {
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    };

    fetchDetail();
  }, [selectedCode]);

  return (
    <div className="min-h-screen bg-slate-50/60 py-10 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">ROSE 恋爱人格图鉴</h1>
            <p className="text-slate-500 mt-2">点击卡片切换查看 16 种人格的恋爱风格与详细介绍。</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/survey?mode=test')}
            className="px-5 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-black transition self-start sm:self-auto"
          >
            测试 ROSE 人格
          </button>
        </div>

        {listLoading ? (
          <div className="h-56 flex items-center justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            暂无可展示的 ROSE 人格内容。
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {items.map((item) => {
                const active = item.rose_code === selectedCode;
                return (
                  <button
                    key={item.rose_code}
                    type="button"
                    onClick={() => setSelectedCode(item.rose_code)}
                    className={`text-left rounded-2xl border p-4 transition ${
                      active
                        ? 'border-violet-300 bg-violet-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <p className={`text-lg font-black ${active ? 'text-violet-700' : 'text-slate-900'}`}>
                      {item.rose_code}
                    </p>
                    <p className="text-sm font-semibold text-slate-700 mt-1">{item.rose_name || '未命名类型'}</p>
                    <p className="text-xs text-slate-500 mt-2 leading-5 min-h-[56px]">
                      {item.summary || '点击查看详细介绍'}
                    </p>
                  </button>
                );
              })}
            </div>

            <motion.div
              key={selectedCode || 'empty'}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-8 bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8"
            >
              <div className="mb-5 pb-5 border-b border-slate-100">
                <p className="text-xs uppercase tracking-widest text-violet-600 font-bold mb-2">Selected Type</p>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                  {selectedItem?.rose_code || '--'} {selectedItem?.rose_name || ''}
                </h2>
              </div>

              {detailLoading ? (
                <div className="h-40 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : !detail?.supported ? (
                <div className="text-slate-500">该人格类型介绍暂未开放。</div>
              ) : (
                <div className="space-y-10 mt-6">
                  {detail.summary ? (
                    <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-6 shadow-sm">
                      <p className="text-violet-900 font-medium leading-relaxed tracking-wide text-lg">{detail.summary}</p>
                    </div>
                  ) : null}
                  <article className="prose prose-slate prose-lg max-w-none prose-headings:font-black prose-headings:tracking-tight prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-4 prose-p:leading-relaxed prose-p:text-slate-700 prose-a:text-violet-600 prose-a:no-underline hover:prose-a:underline prose-li:text-slate-700 prose-strong:text-slate-900 prose-strong:font-bold">
                    {Array.isArray(detail.sections) && detail.sections.length > 0 ? (
                      detail.sections.map((section, index) => (
                        <section key={`${section.title || 'sec'}-${index}`} className="mb-10 last:mb-0">
                          <h3 className="text-2xl font-black text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-violet-500 rounded-full inline-block"></span>
                            {section.title || '类型解读'}
                          </h3>
                          <div className="text-slate-700 leading-loose text-lg">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm, remarkBreaks]}
                              rehypePlugins={[rehypeRaw]}
                            >
                              {section.content || ''}
                            </ReactMarkdown>
                          </div>
                        </section>
                      ))
                    ) : (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        rehypePlugins={[rehypeRaw]}
                      >
                        {detail.markdown || ''}
                      </ReactMarkdown>
                    )}
                  </article>
                </div>
              )}
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}

export default RoseTypes;
