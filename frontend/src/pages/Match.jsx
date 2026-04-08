import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { Loader2, Heart, RefreshCcw, MessageCircle, SendHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSiteConfig } from '../context/SiteConfigContext';

function formatRunTime(value) {
  if (!value) {
    return '--';
  }

  try {
    return new Date(value).toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour12: false
    });
  } catch {
    return value;
  }
}

function Match() {
  const navigate = useNavigate();
  const { siteConfig } = useSiteConfig();
  const [matchData, setMatchData] = useState({
    matched: false,
    survey_completed: false,
    manual_trigger_enabled: false,
    match_result_id: null,
    match_reasons: [],
    history: [],
    self_rose: null,
    self_rose_name: null,
    type_interpretation: null,
    partner_nickname: '',
    partner_gender_label: '',
    partner_campus: '',
    partner_college: '',
    partner_grade: '',
    partner_message_to_partner: '',
    partner_contact_for_match: ''
  });
  const [chatData, setChatData] = useState({
    match_result_id: null,
    messages: []
  });
  const [chatLoading, setChatLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const chatScrollRef = useRef(null);
  const matchSchedule = siteConfig.match_schedule && typeof siteConfig.match_schedule === 'object'
    ? siteConfig.match_schedule
    : { day_of_week: 2, hour: 21, minute: 0 };
  const scheduleDay = Number.isInteger(matchSchedule.day_of_week) ? matchSchedule.day_of_week : 2;
  const scheduleHour = Number.isInteger(matchSchedule.hour) ? matchSchedule.hour : 21;
  const scheduleMinute = Number.isInteger(matchSchedule.minute) ? matchSchedule.minute : 0;
  const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const scheduleLabel = `${weekdayNames[scheduleDay] || '周二'} ${String(scheduleHour).padStart(2, '0')}:${String(scheduleMinute).padStart(2, '0')}`;
  const historyList = Array.isArray(matchData?.history) ? matchData.history : [];
  const historicalMatches = matchData?.matched ? historyList.slice(1) : historyList;

  const normalizeInterpretation = (rawValue) => {
    if (!rawValue || typeof rawValue !== 'object') {
      return null;
    }

    return {
      supported: Boolean(rawValue.supported),
      summary: rawValue.summary || '',
      markdown: rawValue.markdown || ''
    };
  };

  const normalizeMatchReasons = (rawValue) => {
    if (!Array.isArray(rawValue)) {
      return [];
    }

    return rawValue
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        dimension: item.dimension || '',
        title: item.title || '',
        core_label: item.core_label || '',
        matchup_label: item.matchup_label || '',
        reason: item.reason || ''
      }))
      .filter((item) => item.title && item.reason);
  };

  const normalizeChatMessages = (rawValue) => {
    if (!Array.isArray(rawValue)) {
      return [];
    }

    return rawValue
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        id: item.id,
        content: item.content || '',
        created_at: item.created_at || null,
        is_self: Boolean(item.is_self)
      }))
      .filter((item) => item.content);
  };

  const fetchChat = async (matchResultId, { silent = false } = {}) => {
    if (!matchResultId) {
      setChatData({ match_result_id: null, messages: [] });
      return;
    }

    if (!silent) {
      setChatLoading(true);
    }
    try {
      const res = await api.get('/match/chat', {
        params: { match_result_id: matchResultId }
      });
      const payload = res.data.data || {};
      const nextMatchResultId = Number(payload.match_result_id);
      setChatData({
        match_result_id: Number.isInteger(nextMatchResultId) && nextMatchResultId > 0 ? nextMatchResultId : matchResultId,
        messages: normalizeChatMessages(payload.messages)
      });
    } catch {
      if (!silent) {
        setChatData({ match_result_id: matchResultId, messages: [] });
      }
    } finally {
      if (!silent) {
        setChatLoading(false);
      }
    }
  };

  const fetchMatch = async () => {
    setLoading(true);
    try {
      const res = await api.get('/match/my-match');
      const payload = res.data.data || {};
      const nextMatchResultId = Number(payload.match_result_id);
      const normalizedMatchResultId = Number.isInteger(nextMatchResultId) && nextMatchResultId > 0
        ? nextMatchResultId
        : null;

      setMatchData({
        ...payload,
        match_result_id: normalizedMatchResultId,
        match_reasons: normalizeMatchReasons(payload.match_reasons),
        type_interpretation: normalizeInterpretation(payload.type_interpretation)
      });

      if (payload.matched && normalizedMatchResultId) {
        await fetchChat(normalizedMatchResultId, { silent: false });
      } else {
        setChatData({ match_result_id: null, messages: [] });
      }
    } catch {
      setMatchData({
        matched: false,
        survey_completed: false,
        manual_trigger_enabled: false,
        match_result_id: null,
        match_reasons: [],
        history: [],
        self_rose: null,
        self_rose_name: null,
        type_interpretation: null,
        partner_nickname: '',
        partner_gender_label: '',
        partner_campus: '',
        partner_college: '',
        partner_grade: '',
        partner_message_to_partner: '',
        partner_contact_for_match: ''
      });
      setChatData({ match_result_id: null, messages: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatch();
  }, []);

  useEffect(() => {
    if (!matchData?.matched || !matchData?.match_result_id) {
      return undefined;
    }

    const timer = setInterval(() => {
      fetchChat(matchData.match_result_id, { silent: true });
    }, 8000);

    return () => clearInterval(timer);
  }, [matchData?.matched, matchData?.match_result_id]);

  useEffect(() => {
    if (!chatScrollRef.current) {
      return;
    }

    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatData.messages.length]);

  const handleTriggerMatch = async () => {
    setTriggering(true);
    try {
      const res = await api.post('/match/trigger');
      toast.success(res.data.msg);
      await fetchMatch();
    } catch {
      // handled by interceptor
    } finally {
      setTriggering(false);
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    const content = chatDraft.trim();
    if (!content) {
      return;
    }
    if (!matchData?.match_result_id) {
      toast.error('当前没有可用会话');
      return;
    }

    setSendingMessage(true);
    try {
      const res = await api.post('/match/chat', {
        match_result_id: matchData.match_result_id,
        content
      });
      const nextMessage = res.data?.data?.message;
      if (nextMessage) {
        setChatData((prev) => ({
          ...prev,
          match_result_id: matchData.match_result_id,
          messages: [...prev.messages, {
            id: nextMessage.id,
            content: nextMessage.content || content,
            created_at: nextMessage.created_at || new Date().toISOString(),
            is_self: true
          }]
        }));
      } else {
        await fetchChat(matchData.match_result_id, { silent: true });
      }
      setChatDraft('');
    } catch {
      // handled by interceptor
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[2rem] p-8 max-w-4xl w-full shadow-2xl shadow-slate-200 text-center border border-slate-100"
      >
        <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
          <Heart className="w-12 h-12 text-szured animate-pulse" fill="currentColor" />
        </div>

        <h2 className="text-3xl font-black text-slate-800 mb-5 tracking-tight">本周匹配结果</h2>

        {loading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-szured" />
          </div>
        ) : !matchData?.survey_completed ? (
          <div className="py-6 space-y-5">
            <p className="text-slate-600 font-semibold">你还未填写问卷，暂时无法参与匹配。</p>
            <button
              type="button"
              onClick={() => navigate('/survey?mode=test')}
              className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-black transition mx-auto"
            >
              去测试
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {matchData?.matched ? (
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 text-left space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-szured font-bold mb-1">Match</p>
                  <p className="text-xl font-black text-slate-900">
                    {typeof matchData.partner_nickname === 'string' && matchData.partner_nickname.trim()
                      ? matchData.partner_nickname.trim()
                      : '对方未设置昵称'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-white border border-slate-200 rounded-xl p-3">
                    <p className="text-slate-500 mb-1">匹配度</p>
                    <p className="text-2xl font-black text-szured">{matchData.match_percent}%</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-3">
                    <p className="text-slate-500 mb-1">派发时间</p>
                    <p className="font-semibold text-slate-800 text-xs leading-5">{formatRunTime(matchData.run_at)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-white border border-slate-200 rounded-xl p-3">
                    <p className="text-slate-500">你的ROSE</p>
                    <p className="font-black text-slate-900 text-lg">{matchData.self_rose}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-3">
                    <p className="text-slate-500">对方ROSE</p>
                    <p className="font-black text-slate-900 text-lg">{matchData.partner_rose}</p>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <h3 className="text-base font-black text-slate-900">对方信息</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white border border-slate-200 rounded-xl p-3">
                      <p className="text-slate-500 mb-1">性别</p>
                      <p className="font-semibold text-slate-800">{matchData.partner_gender_label || '—'}</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3">
                      <p className="text-slate-500 mb-1">校区</p>
                      <p className="font-semibold text-slate-800">{matchData.partner_campus || '—'}</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3">
                      <p className="text-slate-500 mb-1">学院</p>
                      <p className="font-semibold text-slate-800 text-xs leading-5">{matchData.partner_college || '—'}</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3">
                      <p className="text-slate-500 mb-1">年级</p>
                      <p className="font-semibold text-slate-800">{matchData.partner_grade || '—'}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-left">
                    <p className="text-sm font-black text-slate-900 mb-2">对对方想说的话</p>
                    <p className="text-sm text-slate-700 leading-7 whitespace-pre-wrap">
                      {typeof matchData.partner_message_to_partner === 'string' && matchData.partner_message_to_partner.trim()
                        ? matchData.partner_message_to_partner.trim()
                        : '对方未填写'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-left">
                    <p className="text-sm font-black text-slate-900 mb-2">对方联系方式</p>
                    <p className="text-sm text-slate-700 leading-7 whitespace-pre-wrap">
                      {typeof matchData.partner_contact_for_match === 'string' && matchData.partner_contact_for_match.trim()
                        ? matchData.partner_contact_for_match.trim()
                        : '对方未公开联系方式'}
                    </p>
                  </div>
                </div>

                {Array.isArray(matchData?.match_reasons) && matchData.match_reasons.length > 0 ? (
                  <div className="space-y-3 pt-1">
                    <h3 className="text-base font-black text-slate-900">匹配理由（四维）</h3>
                    <div className="space-y-3">
                      {matchData.match_reasons.map((item) => (
                        <div
                          key={`${item.dimension || 'd'}-${item.title}`}
                          className="rounded-xl border border-slate-200 bg-white p-4"
                        >
                          <p className="text-sm font-black text-slate-900">{item.title}</p>
                          <p className="text-xs text-slate-500 mt-1">匹配核心：{item.core_label || '--'}</p>
                          <p className="text-sm font-bold text-szured mt-2">{item.matchup_label || '--'}</p>
                          <p className="text-sm text-slate-700 leading-7 mt-2 whitespace-pre-wrap">{item.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {matchData?.match_result_id ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-2 text-slate-800 font-black">
                        <MessageCircle className="w-4 h-4" />
                        站内对话
                      </div>
                      <button
                        type="button"
                        onClick={() => fetchChat(matchData.match_result_id, { silent: false })}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        刷新
                      </button>
                    </div>

                    <div
                      ref={chatScrollRef}
                      className="h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2"
                    >
                      {chatLoading ? (
                        <div className="h-full flex items-center justify-center">
                          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                        </div>
                      ) : chatData.messages.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-sm text-slate-400">
                          还没有消息，打个招呼吧。
                        </div>
                      ) : (
                        chatData.messages.map((message) => (
                          <div
                            key={message.id || `${message.created_at}-${message.content}`}
                            className={`flex ${message.is_self ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-6 ${
                                message.is_self
                                  ? 'bg-szured text-white rounded-br-md'
                                  : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md'
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words">{message.content}</p>
                              <p className={`text-[11px] mt-1 ${message.is_self ? 'text-white/80' : 'text-slate-400'}`}>
                                {formatRunTime(message.created_at)}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                      <textarea
                        value={chatDraft}
                        onChange={(event) => setChatDraft(event.target.value)}
                        maxLength={1000}
                        rows={2}
                        placeholder="输入消息..."
                        className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-szured focus:ring-4 focus:ring-szured/10 transition"
                      />
                      <button
                        type="submit"
                        disabled={sendingMessage || !chatDraft.trim()}
                        className="px-4 py-2.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-black transition disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />}
                        发送
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="py-2">
                <p className="text-slate-500 mb-6">
                  {Boolean(matchData?.manual_trigger_enabled)
                    ? `暂无匹配对象，等待 ${scheduleLabel} 自动派发或手动测试触发。`
                    : `暂无匹配对象，等待 ${scheduleLabel} 自动派发。`}
                </p>
                {Boolean(matchData?.manual_trigger_enabled) ? (
                  <button
                    onClick={handleTriggerMatch}
                    disabled={triggering}
                    className="px-6 py-3 bg-szured/10 text-szured font-bold rounded-xl hover:bg-szured hover:text-white transition flex items-center gap-2 mx-auto disabled:opacity-60"
                  >
                    {triggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RefreshCcw className="w-4 h-4" /> 测试触发匹配</>}
                  </button>
                ) : null}
              </div>
            )}

            {historicalMatches.length > 0 ? (
              <div className="text-left">
                <h3 className="text-lg font-black text-slate-900 mb-3">历史匹配记录</h3>
                <div className="space-y-3">
                  {historicalMatches.map((item) => (
                    <div
                      key={`${item.run_id || 'run'}-${item.match_result_id || item.run_at}`}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-slate-900">
                          {(typeof item.partner_nickname === 'string' && item.partner_nickname.trim())
                            ? item.partner_nickname.trim()
                            : '对方未设置昵称'}
                        </p>
                        <p className="text-sm font-black text-szured">{Number.isFinite(item.match_percent) ? `${item.match_percent}%` : '--'}</p>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{formatRunTime(item.run_at)}</p>
                      <p className="text-xs text-slate-600 mt-1">
                        你的ROSE：{item.self_rose || '--'} | 对方ROSE：{item.partner_rose || '--'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default Match;
