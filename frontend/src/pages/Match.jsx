import React, { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Loader2, Heart, RefreshCcw, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { clearAuthStorage } from '../lib/storage';

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
  const [matchData, setMatchData] = useState({
    matched: false,
    self_rose: null,
    self_rose_name: null,
    type_interpretation: null
  });
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [showFullInterpretation, setShowFullInterpretation] = useState(false);
  const navigate = useNavigate();

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

  const fetchMatch = async () => {
    setLoading(true);
    try {
      const res = await api.get('/match/my-match');
      const payload = res.data.data || {};
      setMatchData({
        ...payload,
        type_interpretation: normalizeInterpretation(payload.type_interpretation)
      });
    } catch {
      setMatchData({ matched: false, self_rose: null, self_rose_name: null, type_interpretation: null });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatch();
  }, []);

  const handleTriggerMatch = async () => {
    setTriggering(true);
    try {
      const res = await api.post('/match/trigger');
      toast.success(res.data.msg);
      await fetchMatch();
      setShowFullInterpretation(false);
    } catch {
      // handled by interceptor
    } finally {
      setTriggering(false);
    }
  };

  const logout = () => {
    clearAuthStorage();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative">
      <button
        onClick={logout}
        className="absolute top-6 right-6 text-slate-500 hover:text-szured flex items-center gap-2 font-medium bg-white px-4 py-2 rounded-full shadow-sm"
      >
        退出 <LogOut className="w-4 h-4" />
      </button>

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[2rem] p-8 max-w-xl w-full shadow-2xl shadow-slate-200 text-center border border-slate-100"
      >
        <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
          <Heart className="w-12 h-12 text-szured animate-pulse" fill="currentColor" />
        </div>

        <h2 className="text-3xl font-black text-slate-800 mb-5 tracking-tight">本周匹配结果</h2>

        {loading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-szured" />
          </div>
        ) : matchData?.matched ? (
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 text-left space-y-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-szured font-bold mb-1">Match</p>
              <p className="text-xl font-black text-slate-900">{matchData.partner_email}</p>
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

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-slate-500 text-sm mb-2">致命契合点</p>
              <p className="text-slate-800 font-medium leading-relaxed">{matchData.killer_point}</p>
            </div>


          </div>
        ) : (
          <div className="py-6">
            <p className="text-slate-500 mb-6">暂无匹配对象，等待周二 21:00 自动派发或手动测试触发。</p>

            <button
              onClick={handleTriggerMatch}
              disabled={triggering}
              className="px-6 py-3 bg-szured/10 text-szured font-bold rounded-xl hover:bg-szured hover:text-white transition flex items-center gap-2 mx-auto disabled:opacity-60"
            >
              {triggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RefreshCcw className="w-4 h-4" /> 测试触发匹配</>}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default Match;
