import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, MailCheck, ArrowLeft, UploadCloud } from 'lucide-react';
import api from '../api';
import { useSiteConfig } from '../context/SiteConfigContext';

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
    if (!suffix || !DOMAIN_REGEX.test(suffix)) return '';
    return `*.${suffix}`;
  }
  if (!DOMAIN_REGEX.test(value)) {
    return '';
  }
  return value;
}

function normalizeAllowedDomainRules(rawRules) {
  if (!Array.isArray(rawRules)) return [];
  const seen = new Set();
  const out = [];
  for (const item of rawRules) {
    const rule = normalizeDomainRule(item);
    if (!rule || seen.has(rule)) continue;
    seen.add(rule);
    out.push(rule);
  }
  return out;
}

function isEmailMatchedByRules(rawEmail, rules) {
  if (typeof rawEmail !== 'string') return false;
  const normalizedEmail = rawEmail.trim().toLowerCase();
  const match = normalizedEmail.match(/^[^\s@]+@([^\s@]+)$/);
  if (!match) return false;
  const emailDomain = normalizeDomainRule(match[1]);
  if (!emailDomain) return false;
  for (const rule of rules) {
    if (rule === emailDomain) return true;
    if (rule.startsWith('*.')) {
      const suffix = rule.slice(1);
      if (emailDomain.endsWith(suffix) && emailDomain.length > suffix.length) return true;
    }
  }
  return false;
}

function resolvePrimaryDomain(rules) {
  const exactRule = rules.find((item) => !item.startsWith('*.'));
  if (exactRule) return exactRule;
  const wildcardRule = rules.find((item) => item.startsWith('*.'));
  if (wildcardRule) return `your.${wildcardRule.slice(2)}`;
  return 'mails.jlu.edu.cn';
}

function EmailExceptionApply() {
  const navigate = useNavigate();
  const { siteConfig } = useSiteConfig();
  const allowedDomains = Array.isArray(siteConfig.allowed_email_domains) && siteConfig.allowed_email_domains.length > 0
    ? siteConfig.allowed_email_domains
    : ['mails.jlu.edu.cn'];
  const allowedDomainRules = normalizeAllowedDomainRules(allowedDomains);
  const primaryDomain = resolvePrimaryDomain(allowedDomainRules);
  const domainHint = allowedDomainRules.map((item) => `@${item}`).join('、');

  const [schoolEmail, setSchoolEmail] = useState('');
  const [backupEmail, setBackupEmail] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [screenshot, setScreenshot] = useState(null);

  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verified, setVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const isAllowedSchoolEmail = useMemo(
    () => isEmailMatchedByRules(schoolEmail, allowedDomainRules),
    [schoolEmail, allowedDomainRules]
  );

  const handleSendBackupCode = async () => {
    if (!isAllowedSchoolEmail) {
      toast.error(`必须使用以下域名校园邮箱：${domainHint}`);
      return;
    }
    if (!backupEmail.trim()) {
      toast.error('请填写备用邮箱');
      return;
    }
    setSendingCode(true);
    try {
      await api.post('/auth/email-exception/send-backup-code', {
        school_email: schoolEmail.trim().toLowerCase(),
        backup_email: backupEmail.trim().toLowerCase()
      });
      toast.success('备用邮箱验证码已发送，请查收');
      setVerified(false);
    } catch {
      // handled by interceptor
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyBackupCode = async () => {
    if (!backupCode.trim() || backupCode.trim().length !== 6) {
      toast.error('请输入 6 位备用邮箱验证码');
      return;
    }
    setVerifyingCode(true);
    try {
      await api.post('/auth/email-exception/verify-backup-code', {
        school_email: schoolEmail.trim().toLowerCase(),
        backup_email: backupEmail.trim().toLowerCase(),
        code: backupCode.trim()
      });
      toast.success('备用邮箱验证通过');
      setVerified(true);
    } catch {
      // handled by interceptor
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAllowedSchoolEmail) {
      toast.error(`必须使用以下域名校园邮箱：${domainHint}`);
      return;
    }
    if (!backupEmail.trim()) {
      toast.error('请填写备用邮箱');
      return;
    }
    if (!verified) {
      toast.error('请先完成备用邮箱验证码验证');
      return;
    }
    if (!screenshot) {
      toast.error('请上传学校邮箱登录截图');
      return;
    }

    const formData = new FormData();
    formData.append('school_email', schoolEmail.trim().toLowerCase());
    formData.append('backup_email', backupEmail.trim().toLowerCase());
    formData.append('screenshot', screenshot);

    setSubmitting(true);
    try {
      await api.post('/auth/email-exception/apply', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setShowSuccessModal(true);
    } catch {
      // handled by interceptor
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-szured/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-szuredDark/10 rounded-full blur-3xl pointer-events-none" />

      <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-szured/10 w-full max-w-xl p-8 border border-white">
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={() => navigate('/auth')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
            返回注册/登录
          </button>
          <div className="inline-flex items-center gap-2 text-slate-700">
            <MailCheck className="w-5 h-5 text-szured" />
            <span className="text-sm font-bold">异常校园邮箱人工核验</span>
          </div>
        </div>

        <h2 className="text-2xl font-extrabold text-slate-800 mb-2">邮箱能正常登陆，但收不到验证码？</h2>
        <p className="text-sm text-slate-500 mb-6">
          提交校园邮箱、学校邮箱登录截图，并验证你的备用邮箱。你仍使用校园邮箱账号，但所有邮件都将发送到备用邮箱。
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">校园邮箱</label>
            <input
              type="email"
              required
              value={schoolEmail}
              onChange={(e) => setSchoolEmail(e.target.value)}
              placeholder={`student@${primaryDomain}`}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-szured/10 focus:border-szured outline-none transition"
            />
            <p className="mt-2 text-xs text-slate-500">仅支持域名：{domainHint}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">备用邮箱</label>
            <input
              type="email"
              required
              value={backupEmail}
              onChange={(e) => setBackupEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-szured/10 focus:border-szured outline-none transition"
            />
            <p className="mt-2 text-xs text-slate-500">任何邮箱都可以，但请确保可正常收信。</p>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[220px]">
                <label className="block text-sm font-semibold text-slate-700 mb-2">备用邮箱验证码</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value)}
                  placeholder="6位验证码"
                  className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:ring-4 focus:ring-szured/10 focus:border-szured outline-none transition"
                />
              </div>

              <button
                type="button"
                onClick={handleSendBackupCode}
                disabled={sendingCode}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition font-semibold min-w-[140px] flex items-center justify-center"
              >
                {sendingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : '发送验证码'}
              </button>

              <button
                type="button"
                onClick={handleVerifyBackupCode}
                disabled={verifyingCode}
                className="px-4 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition font-semibold min-w-[140px] flex items-center justify-center"
              >
                {verifyingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : verified ? '已验证' : '验证备用邮箱'}
              </button>
            </div>
            <p className="text-xs text-slate-500">提交申请前必须先验证备用邮箱。</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">学校邮箱登录截图</label>
            <div className="flex items-center gap-3">
              <label className="px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700 cursor-pointer inline-flex items-center gap-2">
                <UploadCloud className="w-4 h-4" />
                选择图片
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setScreenshot(file);
                    e.target.value = '';
                  }}
                />
              </label>
              <span className="text-sm text-slate-600 truncate">
                {screenshot ? screenshot.name : '未选择文件（仅 1 张）'}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">截图中需能看到校园邮箱地址。</p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-ctaRose hover:bg-ctaRoseHover text-white rounded-xl font-bold shadow-lg shadow-[rgba(224,154,173,0.26)] transition flex justify-center items-center disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : '提交异常邮箱申请'}
          </button>
        </form>
      </div>

      {showSuccessModal ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/40 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-800">申请已提交</p>
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-white"
              >
                关闭
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-700 leading-7">
                我们已经为您开启了「优先人工核验通道」，您现在可以正常注册并使用平台，注册验证码会发送到您的备用邮箱。若后台核验未通过，我们会暂停该账号并清理相关数据。
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSuccessModal(false);
                    navigate('/auth', { replace: true });
                  }}
                  className="px-5 py-3 rounded-xl bg-slate-900 hover:bg-black text-white font-bold"
                >
                  去注册
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default EmailExceptionApply;

