import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api';
import SakuraPetalsOverlay from '../components/SakuraPetalsOverlay';
import {
  XINGHUA_TI_STORAGE_KEY,
  XINGHUA_TI_TYPE_CODES,
  XINGHUA_TI_TYPE_COPY
} from '../constants/xinghuaTi';

function isValidTargetXinghuaTi(value) {
  return value === 'same_as_me' || value === 'any' || XINGHUA_TI_TYPE_CODES.includes(value);
}

function emptyPayload() {
  return {
    hard_filter: {
      target_gender: '',
      preferred_time: '',
      target_xinghua_ti: 'same_as_me',
      self_xinghua_ti_type: ''
    },
    match_settings: {
      nickname: '',
      share_contact_with_match: false,
      match_contact_detail: '',
      include_message_to_partner: false,
      message_to_partner: '',
      auto_participate_weekly_match: true
    }
  };
}

function safeReadTi() {
  try {
    const raw = window.localStorage.getItem(XINGHUA_TI_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const type = parsed?.result?.type;
    if (typeof type === 'string' && type.length >= 3) return type;
  } catch {
    // ignore
  }
  return '';
}

export default function XinghuaFestival() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [payload, setPayload] = useState(emptyPayload());

  const tiType = useMemo(() => safeReadTi(), []);
  const tiTitle = tiType ? XINGHUA_TI_TYPE_COPY[tiType]?.title : '';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await api.get('/xinghua-questionnaire');
        if (cancelled) return;
        const data = res.data?.data || {};
        const base = emptyPayload();
        const serverPayload = data.payload && typeof data.payload === 'object' ? data.payload : {};
        base.hard_filter = { ...base.hard_filter, ...(serverPayload.hard_filter || {}) };
        if (XINGHUA_TI_TYPE_CODES.includes(tiType)) {
          base.hard_filter.self_xinghua_ti_type = tiType;
        }
        if (!isValidTargetXinghuaTi(base.hard_filter.target_xinghua_ti)) {
          base.hard_filter.target_xinghua_ti = 'same_as_me';
        }
        base.match_settings = { ...base.match_settings, ...(serverPayload.match_settings || {}) };
        setPayload(base);
        setCompleted(Boolean(data.completed));
      } catch {
        // handled by interceptor
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tiType]);

  const hardOk = useMemo(() => {
    const h = payload.hard_filter || {};
    return Boolean(
      h.target_gender
        && ['sun_am', 'sun_pm', 'any'].includes(h.preferred_time)
        && isValidTargetXinghuaTi(h.target_xinghua_ti)
        && XINGHUA_TI_TYPE_CODES.includes(h.self_xinghua_ti_type)
    );
  }, [payload.hard_filter]);

  const tiTargetVal = payload.hard_filter?.target_xinghua_ti || 'same_as_me';
  const tiPickMode = XINGHUA_TI_TYPE_CODES.includes(tiTargetVal);

  const updateHard = (patch) => setPayload((prev) => ({ ...prev, hard_filter: { ...prev.hard_filter, ...patch } }));
  const updateSettings = (patch) => setPayload((prev) => ({ ...prev, match_settings: { ...prev.match_settings, ...patch } }));

  const persist = async (finalize) => {
    setSaving(true);
    try {
      const res = await api.post('/xinghua-questionnaire', {
        hard_filter: payload.hard_filter,
        match_settings: payload.match_settings,
        finalize
      });
      if (finalize) {
        setCompleted(true);
        toast.success(res.data?.msg || '已参与杏花节搭子匹配');
        navigate('/match', { replace: true });
      } else {
        toast.success(res.data?.msg || '已保存');
      }
    } catch {
      // handled by interceptor
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-pagePink">
        <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.55 }}>
          <Loader2 className="w-10 h-10 animate-spin text-szured" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-pagePink font-xihei text-slate-900 overflow-hidden py-8 px-3 sm:px-6">
      <SakuraPetalsOverlay baseCount={30} />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[rgba(241,228,232,0.12)]" aria-hidden />

      <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative z-10 max-w-3xl mx-auto">
        <div className="bg-cardIvory rounded-3xl border border-roseTint/60 shadow-sm p-7 sm:p-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#1a1a2e] font-ysong tracking-wide">
                杏花节搭子匹配
              </h1>
              <div className="h-4 sm:h-5" aria-hidden />
              {tiType ? (
                <p className="text-sm text-[#4a4a5e] font-shsans">
                  已检测到您的南岭杏花ti：<span className="font-black text-szured">{tiType}</span>
                  {tiTitle ? <span className="ml-2 text-[#7a7278]">（{tiTitle}）</span> : null}
                </p>
              ) : (
                <p className="text-sm text-[#4a4a5e] font-shsans">
                  还没有南岭杏花ti结果？先去测一下，会更好玩。
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate('/xinghua-ti')}
                className="px-4 py-2 rounded-full border-2 border-roseTint/45 bg-white hover:bg-roseLight/35 text-[#4a4a5e] font-bold transition"
              >
                修改南岭杏花ti
              </button>
              <button
                type="button"
                onClick={() => navigate('/xinghua-ti/result')}
                className="px-4 py-2 rounded-full border-2 border-roseTint/45 bg-white hover:bg-roseLight/35 text-[#4a4a5e] font-bold transition"
              >
                查看结果
              </button>
            </div>
          </div>

          {completed ? (
            <div className="mt-8 p-6 bg-white/80 rounded-[1.5rem] border border-roseTint/40 text-center">
              <p className="text-[#1a1a2e] font-bold font-ysong text-lg">您已确认参与杏花节搭子匹配</p>
              <p className="mt-2 text-sm text-[#4a4a5e] font-shsans">如果想修改硬筛选，直接在本页调整后再次保存即可。</p>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => navigate('/survey')}
                  className="w-full py-3 rounded-full bg-ctaRose hover:bg-ctaRoseHover text-white font-bold transition"
                >
                  返回入口
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-8 space-y-6">
            <div className="p-6 bg-white/80 rounded-[1.5rem] border border-roseTint/40">
              <p className="text-[#1a1a2e] font-bold font-shsans mb-4">硬筛选</p>

              <div className="space-y-5">
                <div>
                  <p className="text-sm font-bold text-[#1a1a2e] mb-2 font-shsans">1. 匹配对方的性别</p>
                  <select
                    value={payload.hard_filter.target_gender || ''}
                    onChange={(e) => updateHard({ target_gender: e.target.value })}
                    className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-roseTint/40 focus:border-szured outline-none font-shsans"
                  >
                    <option value="" disabled>请选择</option>
                    <option value="male">男生</option>
                    <option value="female">女生</option>
                  </select>
                </div>

                <div>
                  <p className="text-sm font-bold text-[#1a1a2e] mb-2 font-shsans">2. 你更倾向什么时候去？</p>
                  <select
                    value={payload.hard_filter.preferred_time || ''}
                    onChange={(e) => updateHard({ preferred_time: e.target.value })}
                    className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-roseTint/40 focus:border-szured outline-none font-shsans"
                  >
                    <option value="" disabled>请选择</option>
                    <option value="sun_am">周日上午</option>
                    <option value="sun_pm">周日下午</option>
                    <option value="any">都行</option>
                  </select>
                </div>

                <div>
                  <p className="text-sm font-bold text-[#1a1a2e] mb-2 font-shsans">3. 你希望匹配对方是什么杏花 ti</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => updateHard({ target_xinghua_ti: 'same_as_me' })}
                      className={`py-3 rounded-2xl border-2 font-semibold transition font-shsans text-sm ${
                        tiTargetVal === 'same_as_me'
                          ? 'border-szured/50 bg-roseLight text-szured'
                          : 'border-roseTint/45 bg-white text-[#4a4a5e] hover:border-roseTint'
                      }`}
                    >
                      和我一样（默认）
                    </button>
                    <button
                      type="button"
                      onClick={() => updateHard({ target_xinghua_ti: 'any' })}
                      className={`py-3 rounded-2xl border-2 font-semibold transition font-shsans text-sm ${
                        tiTargetVal === 'any'
                          ? 'border-szured/50 bg-roseLight text-szured'
                          : 'border-roseTint/45 bg-white text-[#4a4a5e] hover:border-roseTint'
                      }`}
                    >
                      都行
                    </button>
                    <button
                      type="button"
                      onClick={() => updateHard({
                        target_xinghua_ti: tiPickMode ? tiTargetVal : XINGHUA_TI_TYPE_CODES[0]
                      })}
                      className={`py-3 rounded-2xl border-2 font-semibold transition font-shsans text-sm ${
                        tiPickMode
                          ? 'border-szured/50 bg-roseLight text-szured'
                          : 'border-roseTint/45 bg-white text-[#4a4a5e] hover:border-roseTint'
                      }`}
                    >
                      指定杏花 ti 类型
                    </button>
                  </div>
                  {tiPickMode ? (
                    <div className="mt-4">
                      <p className="text-xs text-[#7a7278] font-shsans mb-2">在列表中滚动选择一种十六型人格（杏花 ti）</p>
                      <select
                        size={8}
                        value={tiTargetVal}
                        onChange={(e) => updateHard({ target_xinghua_ti: e.target.value })}
                        className="w-full rounded-2xl border-2 border-roseTint/40 bg-white px-3 py-2 font-shsans text-sm text-[#1a1a2e] focus:border-szured outline-none overflow-y-auto max-h-[14rem]"
                      >
                        {XINGHUA_TI_TYPE_CODES.map((code) => (
                          <option key={code} value={code}>
                            {code} — {XINGHUA_TI_TYPE_COPY[code]?.title || code}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="p-6 bg-white/80 rounded-[1.5rem] border border-roseTint/40">
              <p className="text-[#1a1a2e] font-bold font-shsans mb-4">匹配设置（复用交友/恋爱）</p>
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-bold text-[#1a1a2e] mb-2 font-shsans">1. 你的昵称名是？</p>
                  <input
                    type="text"
                    maxLength={20}
                    value={payload.match_settings.nickname || ''}
                    onChange={(e) => updateSettings({ nickname: e.target.value })}
                    className="w-full px-5 py-4 rounded-2xl border-2 border-roseTint/40 focus:border-szured outline-none bg-white font-shsans"
                    placeholder="可不填，最多20字"
                  />
                  <p className="mt-1 text-xs text-[#4a4a5e]/80 font-shsans">已输入 {String((payload.match_settings.nickname || '').length)}/20</p>
                </div>

                <div>
                  <p className="text-sm font-bold text-[#1a1a2e] mb-2 font-shsans">2. 是否向对方展示联系方式</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => updateSettings({ share_contact_with_match: false, match_contact_detail: '' })}
                      className={`flex-1 py-3 rounded-2xl border-2 font-semibold transition ${
                        payload.match_settings.share_contact_with_match === false
                          ? 'border-szured/50 bg-roseLight text-szured'
                          : 'border-roseTint/45 bg-white text-[#4a4a5e] hover:border-roseTint'
                      }`}
                    >
                      否
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSettings({ share_contact_with_match: true })}
                      className={`flex-1 py-3 rounded-2xl border-2 font-semibold transition ${
                        payload.match_settings.share_contact_with_match === true
                          ? 'border-szured/50 bg-roseLight text-szured'
                          : 'border-roseTint/45 bg-white text-[#4a4a5e] hover:border-roseTint'
                      }`}
                    >
                      是
                    </button>
                  </div>
                </div>

                {payload.match_settings.share_contact_with_match ? (
                  <div className="ml-3 pl-3 border-l-2 border-roseTint/25">
                    <p className="text-sm font-bold text-[#1a1a2e] mb-2 font-shsans">联系方式（必填，1～20字）</p>
                    <input
                      type="text"
                      maxLength={20}
                      value={payload.match_settings.match_contact_detail || ''}
                      onChange={(e) => updateSettings({ match_contact_detail: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border-2 border-roseTint/40 focus:border-szured outline-none bg-white font-shsans"
                      placeholder="请输入联系方式"
                    />
                  </div>
                ) : null}

                <div>
                  <p className="text-sm font-bold text-[#1a1a2e] mb-2 font-shsans">3. 是否有对对方想说的话</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => updateSettings({ include_message_to_partner: false, message_to_partner: '' })}
                      className={`flex-1 py-3 rounded-2xl border-2 font-semibold transition ${
                        payload.match_settings.include_message_to_partner === false
                          ? 'border-szured/50 bg-roseLight text-szured'
                          : 'border-roseTint/45 bg-white text-[#4a4a5e] hover:border-roseTint'
                      }`}
                    >
                      否
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSettings({ include_message_to_partner: true })}
                      className={`flex-1 py-3 rounded-2xl border-2 font-semibold transition ${
                        payload.match_settings.include_message_to_partner === true
                          ? 'border-szured/50 bg-roseLight text-szured'
                          : 'border-roseTint/45 bg-white text-[#4a4a5e] hover:border-roseTint'
                      }`}
                    >
                      是
                    </button>
                  </div>
                </div>

                {payload.match_settings.include_message_to_partner ? (
                  <div className="ml-3 pl-3 border-l-2 border-roseTint/25">
                    <p className="text-sm font-bold text-[#1a1a2e] mb-2 font-shsans">对对方想说的话（必填，1～200字）</p>
                    <textarea
                      rows={4}
                      maxLength={200}
                      value={payload.match_settings.message_to_partner || ''}
                      onChange={(e) => updateSettings({ message_to_partner: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border-2 border-roseTint/40 focus:border-szured outline-none bg-white font-shsans resize-none leading-relaxed"
                      placeholder="请输入对对方想说的话"
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-2">
              <button
                type="button"
                disabled={!hardOk || saving}
                onClick={() => persist(true)}
                className="w-full py-5 rounded-[1.25rem] text-lg sm:text-xl bg-ctaRose hover:bg-ctaRoseHover text-white font-black shadow-[0_12px_36px_rgba(224,154,173,0.35)] disabled:opacity-60 transition"
              >
                {saving ? <Loader2 className="w-7 h-7 animate-spin mx-auto" /> : '立即参与'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

