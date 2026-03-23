import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSiteConfig } from '../context/SiteConfigContext';
import { setAccessToken, setIsAdmin } from '../lib/storage';

function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const navigate = useNavigate();
  const { siteConfig } = useSiteConfig();

  const allowedDomains = Array.isArray(siteConfig.allowed_email_domains) && siteConfig.allowed_email_domains.length > 0
    ? siteConfig.allowed_email_domains
    : ['szu.edu.cn'];

  const primaryDomain = allowedDomains[0];
  const domainHint = allowedDomains.map((item) => `@${item}`).join('、');

  const isAllowedEmail = (rawEmail) => {
    if (typeof rawEmail !== 'string') {
      return false;
    }

    const normalized = rawEmail.trim().toLowerCase();
    const match = normalized.match(/^[^\s@]+@([^\s@]+)$/);
    if (!match) {
      return false;
    }

    return allowedDomains.includes(match[1]);
  };

  const handleSendCode = async () => {
    if (!isAllowedEmail(email)) {
      toast.error(`必须使用以下域名邮箱：${domainHint}`);
      return;
    }

    setCodeLoading(true);
    try {
      await api.post('/auth/send-code', { email: email.trim().toLowerCase() });
      toast.success('验证码已发送，请查收邮箱', { duration: 4000 });
    } catch {
      // handled by interceptor
    } finally {
      setCodeLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const res = await api.post('/auth/login', {
          email: email.trim().toLowerCase(),
          password
        });
        setAccessToken(res.data.data.access_token);
        setIsAdmin(Boolean(res.data.data.is_admin));
        toast.success(res.data.msg);
        navigate('/survey', { replace: true });
      } else {
        await api.post('/auth/register', {
          email: email.trim().toLowerCase(),
          password,
          code
        });
        toast.success('注册成功，请登录');
        setIsLogin(true);
      }
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-szured/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-szuredDark/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/90 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-szured/10 w-full max-w-md p-8 border border-white"
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-slate-800 mb-2">{isLogin ? '欢迎回来' : `加入 ${siteConfig.brand_name}`}</h2>
          <p className="text-slate-500 text-sm">校园专属灵魂契合平台</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">校园邮箱</label>
            <input
              type="email"
              required
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-szured/10 focus:border-szured outline-none transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`student@${primaryDomain}`}
            />
            <p className="mt-2 text-xs text-slate-500">支持域名：{domainHint}</p>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">验证码</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-szured/10 focus:border-szured outline-none transition"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6位验证码"
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={codeLoading}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition font-semibold min-w-[110px] flex items-center justify-center"
                >
                  {codeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '获取验证码'}
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">密码</label>
            <input
              type="password"
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-szured/10 focus:border-szured outline-none transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少6位"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-szured hover:bg-szuredDark text-white rounded-xl font-bold shadow-lg shadow-szured/20 transition flex justify-center items-center disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? '登录' : '注册')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-slate-500 hover:text-szured font-semibold transition cursor-pointer bg-transparent border-none"
          >
            {isLogin ? '没有账号？点击注册' : '已有账号？直接登录'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default Auth;
