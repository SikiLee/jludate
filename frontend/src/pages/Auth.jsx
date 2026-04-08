import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSiteConfig } from '../context/SiteConfigContext';
import { getAccessToken, setAccessToken, setIsAdmin } from '../lib/storage';
import { CAMPUS_OPTIONS } from '../constants/campuses';
import { COLLEGE_OPTIONS } from '../constants/colleges';
import { GRADE_OPTIONS } from '../constants/grades';

const BIOLOGY_GENDER_OPTIONS = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' }
];

const DOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

function normalizeDomainRule(rawValue) {
  if (typeof rawValue !== 'string') {
    return '';
  }

  const value = rawValue.trim().toLowerCase().replace(/^@+/, '');
  if (!value || /\.\./.test(value)) {
    return '';
  }

  if (value.startsWith('*.')) {
    const suffix = value.slice(2);
    if (!suffix || !DOMAIN_REGEX.test(suffix)) {
      return '';
    }
    return `*.${suffix}`;
  }

  if (!DOMAIN_REGEX.test(value)) {
    return '';
  }
  return value;
}

function normalizeAllowedDomainRules(rawRules) {
  if (!Array.isArray(rawRules)) {
    return [];
  }

  const result = [];
  const seen = new Set();
  for (const item of rawRules) {
    const rule = normalizeDomainRule(item);
    if (!rule || seen.has(rule)) {
      continue;
    }
    seen.add(rule);
    result.push(rule);
  }
  return result;
}

function isEmailMatchedByRules(rawEmail, rules) {
  if (typeof rawEmail !== 'string') {
    return false;
  }

  const normalizedEmail = rawEmail.trim().toLowerCase();
  const match = normalizedEmail.match(/^[^\s@]+@([^\s@]+)$/);
  if (!match) {
    return false;
  }

  const emailDomain = normalizeDomainRule(match[1]);
  if (!emailDomain) {
    return false;
  }

  for (const rule of rules) {
    if (rule === emailDomain) {
      return true;
    }

    if (rule.startsWith('*.')) {
      const suffix = rule.slice(1); // ".edu.cn"
      if (emailDomain.endsWith(suffix) && emailDomain.length > suffix.length) {
        return true;
      }
    }
  }

  return false;
}

function resolvePrimaryDomain(rules) {
  const exactRule = rules.find((item) => !item.startsWith('*.'));
  if (exactRule) {
    return exactRule;
  }

  const wildcardRule = rules.find((item) => item.startsWith('*.'));
  if (wildcardRule) {
    return `your.${wildcardRule.slice(2)}`;
  }

  return 'mails.jlu.edu.cn';
}

function Auth() {
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [regGender, setRegGender] = useState('');
  const [regGrade, setRegGrade] = useState('');
  const [regCampus, setRegCampus] = useState('');
  const [regCollege, setRegCollege] = useState('');
  const navigate = useNavigate();
  const { siteConfig } = useSiteConfig();

  const allowedDomains = Array.isArray(siteConfig.allowed_email_domains) && siteConfig.allowed_email_domains.length > 0
    ? siteConfig.allowed_email_domains
    : ['mails.jlu.edu.cn'];
  const allowedDomainRules = normalizeAllowedDomainRules(allowedDomains);
  const isLogin = authMode === 'login';
  const isRegister = authMode === 'register';
  const isResetPassword = authMode === 'reset';

  const primaryDomain = resolvePrimaryDomain(allowedDomainRules);
  const domainHint = allowedDomainRules.map((item) => `@${item}`).join('、');

  useEffect(() => {
    if (getAccessToken()) {
      navigate('/survey', { replace: true });
    }
  }, [navigate]);

  const isAllowedEmail = (rawEmail) => {
    return isEmailMatchedByRules(rawEmail, allowedDomainRules);
  };

  const handleSendCode = async () => {
    if (!isAllowedEmail(email)) {
      toast.error(`必须使用以下域名邮箱：${domainHint}`);
      return;
    }

    setCodeLoading(true);
    try {
      const endpoint = isResetPassword ? '/auth/forgot-password/send-code' : '/auth/send-code';
      await api.post(endpoint, { email: email.trim().toLowerCase() });
      toast.success(isResetPassword ? '重置验证码已发送，请查收邮箱' : '验证码已发送，请查收邮箱', { duration: 4000 });
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
      } else if (isRegister) {
        await api.post('/auth/register', {
          email: email.trim().toLowerCase(),
          password,
          code,
          gender: regGender,
          grade: regGrade,
          campus: regCampus,
          college: regCollege
        });
        toast.success('注册成功，请登录');
        setAuthMode('login');
        setCode('');
        setRegGender('');
        setRegGrade('');
        setRegCampus('');
        setRegCollege('');
      } else {
        await api.post('/auth/forgot-password/reset', {
          email: email.trim().toLowerCase(),
          password,
          code
        });
        toast.success('密码重置成功，请使用新密码登录');
        setAuthMode('login');
        setCode('');
        setPassword('');
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
          <h2
            className={`text-3xl font-extrabold text-slate-800 mb-2 ${
              isLogin ? 'cursor-pointer select-none' : ''
            }`}
            role={isLogin ? 'button' : undefined}
            tabIndex={isLogin ? 0 : undefined}
            onClick={isLogin ? () => navigate('/') : undefined}
            onKeyDown={
              isLogin
                ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') navigate('/');
                }
                : undefined
            }
            aria-label={isLogin ? '返回首页' : undefined}
          >
            {isLogin ? '配吉友 | JLUDate' : isRegister ? `加入 ${siteConfig.brand_name}` : '找回密码'}
          </h2>
          <p className="text-slate-500 text-sm">在吉大，遇见有缘的TA</p>
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
            <p className="mt-2 text-xs text-slate-500">吉大学生邮箱域名：{domainHint}(此处登录需带后缀，若您注册时登录吉大学生邮箱网站显示用户不存在,系长时间不使用邮箱被学校停用，请在工作日上午8:00-11:30或下午13:30-16:00联系学校邮箱管理员0431-85166439报您的学号重新启用)</p>
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
            <label className="block text-sm font-semibold text-slate-700 mb-2">{isResetPassword ? '新密码' : '密码'}</label>
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

          {isRegister ? (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">性别</label>
                <select
                  required
                  value={regGender}
                  onChange={(e) => setRegGender(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-szured/10 focus:border-szured outline-none transition ${
                    regGender ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  <option value="" disabled>请选择生物学性别</option>
                  {BIOLOGY_GENDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">年级</label>
                <select
                  required
                  value={regGrade}
                  onChange={(e) => setRegGrade(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-szured/10 focus:border-szured outline-none transition ${
                    regGrade ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  <option value="" disabled>请选择年级</option>
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-500">注：医学院大五和大四合并</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">校区</label>
                <select
                  required
                  value={regCampus}
                  onChange={(e) => setRegCampus(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-szured/10 focus:border-szured outline-none transition ${
                    regCampus ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  <option value="" disabled>请选择校区</option>
                  {CAMPUS_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">学院</label>
                <select
                  required
                  value={regCollege}
                  onChange={(e) => setRegCollege(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-szured/10 focus:border-szured outline-none transition ${
                    regCollege ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  <option value="" disabled>请选择学院</option>
                  {COLLEGE_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-ctaRose hover:bg-ctaRoseHover text-white rounded-xl font-bold shadow-lg shadow-[rgba(224,154,173,0.26)] transition flex justify-center items-center disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? '登录' : isRegister ? '注册' : '重置密码')}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          {isLogin ? (
            <>
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className="text-sm text-slate-500 hover:text-szured font-semibold transition cursor-pointer bg-transparent border-none block w-full"
              >
                没有账号？点击注册
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('reset')}
                className="text-sm text-slate-500 hover:text-szured font-semibold transition cursor-pointer bg-transparent border-none block w-full"
              >
                忘记密码？
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className="text-sm text-slate-500 hover:text-szured font-semibold transition cursor-pointer bg-transparent border-none"
            >
              返回登录
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default Auth;
