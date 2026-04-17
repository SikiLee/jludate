import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, RefreshCw, Send, X } from 'lucide-react';
import SakuraPetalsOverlay from '../components/SakuraPetalsOverlay';
import api from '../api';

const MATCH_CATEGORY_OPTIONS = [
  { key: 'love', label: '恋爱匹配' },
  { key: 'friend', label: '交友匹配' }
];

const MODULE_LABEL_MAP = {
  1: '两个人是否方向一致',
  2: '两个人相处是否舒服',
  3: '两个人是否能彼此带动'
};

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120] bg-[#1a1a2e]/45 backdrop-blur-[2px] p-4 flex items-center justify-center">
      <div className="w-full max-w-3xl max-h-[88vh] overflow-hidden rounded-3xl border border-roseTint/45 bg-cardIvory shadow-xl">
        <div className="px-6 py-4 border-b border-roseTint/30 flex items-center justify-between">
          <h3 className="text-lg font-black text-[#1a1a2e] font-shsans">{title}</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-roseLight/40">
            <X className="w-4 h-4 text-[#4a4a5e]" />
          </button>
        </div>
        <div className="p-6 overflow-auto max-h-[calc(88vh-64px)]">{children}</div>
      </div>
    </div>
  );
}

function Match() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = useMemo(() => {
    const raw = searchParams.get('category');
    return MATCH_CATEGORY_OPTIONS.some((item) => item.key === raw) ? raw : 'love';
  }, [searchParams]);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [chatError, setChatError] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [openModuleKeys, setOpenModuleKeys] = useState({});
  const chatPollRef = useRef(null);
  const matchResultId = data?.match?.match_result_id || null;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError('');
        const res = await api.get('/match/my-match', { params: { category }, signal: controller.signal });
        if (!cancelled) setData(res.data?.data || null);
      } catch {
        if (!cancelled) setError('加载匹配结果失败，请稍后重试');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [category]);

  useEffect(() => {
    if (!matchResultId) return () => {};
    let cancelled = false;
    const controller = new AbortController();
    const tick = async () => {
      try {
        setChatLoading(true);
        const res = await api.get('/match/chat', {
          params: { match_result_id: matchResultId },
          signal: controller.signal
        });
        if (!cancelled) {
          setChatMessages(res.data?.data?.messages || []);
          setChatError('');
        }
      } catch {
        if (!cancelled) setChatError('聊天加载失败，请稍后重试');
      } finally {
        if (!cancelled) setChatLoading(false);
      }
    };
    tick();
    chatPollRef.current = setInterval(tick, 6000);
    return () => {
      cancelled = true;
      controller.abort();
      if (chatPollRef.current) clearInterval(chatPollRef.current);
      chatPollRef.current = null;
    };
  }, [matchResultId]);

  const sendChat = async () => {
    if (!matchResultId || !chatText.trim()) return;
    const text = chatText.trim();
    setChatText('');
    try {
      await api.post('/match/chat', { match_result_id: matchResultId, message_text: text });
      const res = await api.get('/match/chat', { params: { match_result_id: matchResultId } });
      setChatMessages(res.data?.data?.messages || []);
      setChatError('');
    } catch {
      setChatError('发送失败，请重试');
    }
  };

  return (
    <div className="relative min-h-screen bg-pagePink p-6 font-xihei overflow-hidden">
      <SakuraPetalsOverlay baseCount={28} />
      <div className="absolute inset-0 z-[1] bg-[rgba(241,228,232,0.12)] pointer-events-none" aria-hidden />

      <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }} className="relative z-10 w-full max-w-4xl mx-auto">
        <div className="bg-cardIvory rounded-[2.2rem] border border-roseTint/70 shadow-lg p-7 sm:p-10">
          <div className="flex items-center justify-between gap-3 mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1a1a2e] font-ysong">匹配结果</h2>
            <div className="flex gap-2">
              <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-roseTint/40 bg-white/80 text-xs font-bold text-[#4a4a5e] hover:bg-roseLight/40">
                <RefreshCw className="w-3.5 h-3.5" />
                刷新
              </button>
            </div>
          </div>
          <div className="mb-6 flex flex-wrap gap-2">
            {MATCH_CATEGORY_OPTIONS.map((item) => {
              const active = item.key === category;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSearchParams({ category: item.key })}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                    active
                      ? 'bg-ctaRose text-white border-ctaRose'
                      : 'bg-white/80 text-[#4a4a5e] border-roseTint/40 hover:bg-roseLight/40'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="py-10 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-szured" /></div>
          ) : error ? (
            <p className="text-center text-[#4a4a5e] font-shsans">{error}</p>
          ) : data?.status !== 'matched' ? (
            <p className="text-center text-[#4a4a5e] font-shsans">{data?.message || '本周暂未匹配到合适对象'}</p>
          ) : (
            <div className="space-y-5">
              <div className="rounded-3xl border border-roseTint/35 bg-white/70 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-[#7a7278] font-shsans">对方个人信息</p>
                    <p className="mt-1 text-xl font-black text-[#1a1a2e] font-shsans">{data.partner?.nickname || '该用户未填写昵称'}</p>
                    <p className="mt-1 text-sm text-[#4a4a5e] font-shsans">{data.partner?.college || '学院未填'} · {data.partner?.grade || '年级未填'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#7a7278] font-shsans">总契合度</p>
                    <p className="text-4xl sm:text-5xl leading-none font-black text-szured font-shsans">
                      {Number(data.match?.final_match_percent || 0).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-roseTint/35 bg-white/70 p-6">
                <p className="text-sm font-black text-[#1a1a2e] font-shsans mb-3">匹配理由</p>
                <div className="space-y-2">
                  {(data.match_reasons || []).slice(0, 3).map((reason, idx) => (
                    <p key={`reason-${idx}`} className="text-sm text-[#4a4a5e] font-shsans leading-relaxed">- {reason}</p>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-roseTint/35 bg-white/70 p-6">
                <p className="text-sm font-black text-[#1a1a2e] font-shsans mb-2">对方展示信息</p>
                {data.partner?.partner_contact_for_match ? (
                  <p className="text-sm text-[#4a4a5e] font-shsans">联系方式：{data.partner.partner_contact_for_match}</p>
                ) : (
                  <p className="text-sm text-[#7a7278] font-shsans">对方未公开联系方式</p>
                )}
                {data.partner?.message_to_partner ? (
                  <p className="mt-2 text-sm text-[#4a4a5e] font-shsans whitespace-pre-wrap">想说的话：{data.partner.message_to_partner}</p>
                ) : null}
              </div>

              <div className="rounded-3xl border border-roseTint/35 bg-white/70 p-6">
                <p className="text-sm font-black text-[#1a1a2e] font-shsans mb-3">站内聊天</p>
                {chatError ? <p className="text-xs text-[#7a7278] mb-2">{chatError}</p> : null}
                <div className="h-56 overflow-auto rounded-2xl border border-roseTint/25 bg-white/70 p-3 space-y-2">
                  {chatLoading && chatMessages.length === 0 ? (
                    <div className="h-full flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-szured" /></div>
                  ) : chatMessages.length === 0 ? (
                    <p className="text-xs text-[#7a7278] text-center pt-20">还没有消息</p>
                  ) : chatMessages.map((m) => {
                    const mine = m.sender_respondent_id === data?.self?.respondent_id;
                    return (
                      <div key={String(m.id)} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm ${mine ? 'bg-roseLight/70' : 'bg-white'} border border-roseTint/25`}>
                          {m.message_text}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }}
                    placeholder="输入消息..."
                    className="flex-1 px-3 py-2 rounded-xl border border-roseTint/35 bg-white/80 text-sm outline-none focus:border-szured"
                    maxLength={500}
                  />
                  <button type="button" onClick={sendChat} disabled={!chatText.trim()} className="px-3 py-2 rounded-xl bg-ctaRose text-white disabled:opacity-50">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-5 text-xs font-shsans text-[#7a7278]">
                <button type="button" onClick={() => setReportOpen(true)} className="underline underline-offset-2 hover:text-[#4a4a5e]">查看匹配详细报告</button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      <Modal open={reportOpen} title="匹配详细报告" onClose={() => setReportOpen(false)}>
        {!data?.detailed_report ? (
          <p className="text-sm text-[#7a7278] font-shsans">暂无详细报告</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-roseTint/25 bg-white p-4 text-center">
              <p className="text-xs text-[#7a7278] font-shsans">总契合度</p>
              <p className="mt-1 text-4xl font-black text-szured font-shsans">{Number(data.detailed_report.total_score || 0).toFixed(1)}%</p>
            </div>
            {(data.detailed_report.modules || []).map((m) => {
              const open = Boolean(openModuleKeys[m.module_index]);
              return (
                <div key={`mod-${m.module_index}`} className="rounded-2xl border border-roseTint/25 bg-white/70 p-4">
                  <button type="button" onClick={() => setOpenModuleKeys((prev) => ({ ...prev, [m.module_index]: !open }))} className="w-full flex items-center justify-between text-left">
                    <span className="text-sm font-bold text-[#1a1a2e] font-shsans">
                      {MODULE_LABEL_MAP[m.module_index] || `模块 ${m.module_index}`}
                    </span>
                    <span className="text-sm font-black text-[#1a1a2e]">{Number(m.module_score || 0).toFixed(1)}%</span>
                  </button>
                  {open ? (
                    <div className="mt-3 space-y-3">
                      {(m.top_questions || []).map((qItem) => (
                        <div key={`q-${m.module_index}-${qItem.question_number}`} className="rounded-xl border border-roseTint/20 bg-white p-3">
                          <p className="text-sm font-bold text-[#1a1a2e]">{qItem.question_title}</p>
                          <p className="mt-1 text-sm text-[#4a4a5e] leading-relaxed">{qItem.reason}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Match;
