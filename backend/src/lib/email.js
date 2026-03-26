import nodemailer from 'nodemailer';
import { surveyPool } from 'lib/db';
import { getEmailTemplates, getSiteBrandName } from 'lib/siteConfig';

const SMTP_ENABLED = process.env.SMTP_ENABLED !== 'false';
const SMTP_HOST = typeof process.env.SMTP_HOST === 'string' ? process.env.SMTP_HOST.trim() : '';
const SMTP_PORT = Number.parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = typeof process.env.SMTP_USER === 'string' ? process.env.SMTP_USER : '';
const SMTP_PASS = typeof process.env.SMTP_PASS === 'string' ? process.env.SMTP_PASS : '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || 'noreply@example.com';
const SMTP_REQUIRE_TLS = process.env.SMTP_REQUIRE_TLS === 'true';
const SMTP_TLS_REJECT_UNAUTHORIZED = process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false';
const WEB_BASE_URL = typeof process.env.WEB_BASE_URL === 'string'
  ? process.env.WEB_BASE_URL.trim()
  : '';

let warnedSmtpDisabled = false;
let warnedSmtpMissing = false;
const TEMPLATE_VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function createTransporter() {
  if (!SMTP_ENABLED) {
    return null;
  }

  if (!SMTP_HOST || !Number.isFinite(SMTP_PORT) || SMTP_PORT <= 0) {
    return null;
  }

  const transportConfig = {
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: SMTP_USER || SMTP_PASS
      ? {
          user: SMTP_USER,
          pass: SMTP_PASS
        }
      : undefined,
    requireTLS: SMTP_REQUIRE_TLS,
    tls: {
      rejectUnauthorized: SMTP_TLS_REJECT_UNAUTHORIZED
    }
  };

  return nodemailer.createTransport(transportConfig);
}

const transporter = createTransporter();

async function resolveBrandName() {
  try {
    return await getSiteBrandName(surveyPool);
  } catch {
    return 'unidate';
  }
}

async function resolveEmailTemplates() {
  try {
    return await getEmailTemplates(surveyPool);
  } catch {
    return null;
  }
}

function resolveMatchResultUrl() {
  const fallback = 'http://localhost:8383';
  const baseUrl = WEB_BASE_URL || fallback;
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  return `${normalizedBase}/match`;
}

function applyTemplateVariables(template, variables) {
  if (typeof template !== 'string') {
    return '';
  }

  return template.replace(TEMPLATE_VARIABLE_PATTERN, (_, key) => {
    if (!Object.prototype.hasOwnProperty.call(variables, key)) {
      return '';
    }

    const value = variables[key];
    if (value === null || value === undefined) {
      return '';
    }

    return String(value);
  });
}

async function sendMailSafely(payload, label) {
  if (!SMTP_ENABLED) {
    if (!warnedSmtpDisabled) {
      warnedSmtpDisabled = true;
      console.warn('SMTP is disabled via SMTP_ENABLED=false; mail sending skipped.');
    }
    return;
  }

  if (!transporter) {
    if (!warnedSmtpMissing) {
      warnedSmtpMissing = true;
      console.warn('SMTP is not configured correctly; set SMTP_HOST/SMTP_PORT (and SMTP auth vars if needed).');
    }
    return;
  }

  try {
    await transporter.sendMail(payload);
  } catch (error) {
    console.error(`${label}:`, error?.message || error);
  }
}

export async function sendVerificationEmail(toEmail, code) {
  const brandName = await resolveBrandName();
  const templates = await resolveEmailTemplates();
  const subjectTemplate = templates?.verification?.subject || '{{brand_name}} Registration Verification';
  const bodyTemplate = templates?.verification?.body
    || '【{{brand_name}}】您的验证码是: {{code}}\n一次深度问卷，匹配一个和你最契合的人。欢迎加入校园专属配对平台！';
  const templateVariables = {
    brand_name: brandName,
    code
  };

  await sendMailSafely(
    {
      from: SMTP_FROM,
      to: toEmail,
      subject: applyTemplateVariables(subjectTemplate, templateVariables),
      text: applyTemplateVariables(bodyTemplate, templateVariables)
    },
    'Failed to send verification email'
  );
}

export async function sendPasswordResetEmail(toEmail, code) {
  const brandName = await resolveBrandName();
  const subjectTemplate = '【{{brand_name}}】密码重置验证码';
  const bodyTemplate = [
    '【{{brand_name}}】你正在重置登录密码。',
    '验证码：{{code}}',
    '如非本人操作，请忽略本邮件。'
  ].join('\n');
  const templateVariables = {
    brand_name: brandName,
    code
  };

  await sendMailSafely(
    {
      from: SMTP_FROM,
      to: toEmail,
      subject: applyTemplateVariables(subjectTemplate, templateVariables),
      text: applyTemplateVariables(bodyTemplate, templateVariables)
    },
    'Failed to send password reset email'
  );
}

export async function sendMatchEmail({
  toEmail,
  partnerEmail,
  matchPercent,
  selfRose,
  partnerRose,
  runAt
}) {
  const brandName = await resolveBrandName();
  const templates = await resolveEmailTemplates();
  const formattedRunTime = new Date(runAt).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false
  });
  const subjectTemplate = templates?.match_result?.subject || '【{{brand_name}}】你的本周匹配结果已送达';
  const bodyTemplate = templates?.match_result?.body || [
    '【{{brand_name}} 每周匹配】',
    '你已成功匹配，请登录网站查看匹配详情与对话。',
    '查看入口：{{match_url}}',
    '派发时间：{{run_at}} ({{timezone}})'
  ].join('\n');
  const templateVariables = {
    brand_name: brandName,
    match_url: resolveMatchResultUrl(),
    partner_email: partnerEmail,
    match_percent: matchPercent,
    self_rose: selfRose,
    partner_rose: partnerRose,
    run_at: formattedRunTime,
    timezone: 'Asia/Shanghai'
  };

  await sendMailSafely(
    {
      from: SMTP_FROM,
      to: toEmail,
      subject: applyTemplateVariables(subjectTemplate, templateVariables),
      text: applyTemplateVariables(bodyTemplate, templateVariables)
    },
    'Failed to send match email'
  );
}
