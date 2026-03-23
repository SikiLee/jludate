import nodemailer from 'nodemailer';
import { surveyPool } from 'lib/db';
import { getSiteBrandName } from 'lib/siteConfig';

const SMTP_ENABLED = process.env.SMTP_ENABLED !== 'false';
const SMTP_HOST = typeof process.env.SMTP_HOST === 'string' ? process.env.SMTP_HOST.trim() : '';
const SMTP_PORT = Number.parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = typeof process.env.SMTP_USER === 'string' ? process.env.SMTP_USER : '';
const SMTP_PASS = typeof process.env.SMTP_PASS === 'string' ? process.env.SMTP_PASS : '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || 'noreply@example.com';
const SMTP_REQUIRE_TLS = process.env.SMTP_REQUIRE_TLS === 'true';
const SMTP_TLS_REJECT_UNAUTHORIZED = process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false';

let warnedSmtpDisabled = false;
let warnedSmtpMissing = false;

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
  await sendMailSafely(
    {
      from: SMTP_FROM,
      to: toEmail,
      subject: `${brandName} Registration Verification`,
      text: `【${brandName}】您的验证码是: ${code}\n一次深度问卷，匹配一个和你最契合的人。欢迎加入校园专属配对平台！`
    },
    'Failed to send verification email'
  );
}

export async function sendMatchEmail({
  toEmail,
  partnerEmail,
  matchPercent,
  selfRose,
  partnerRose,
  killerPoint,
  runAt
}) {
  const brandName = await resolveBrandName();
  const formattedRunTime = new Date(runAt).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false
  });

  await sendMailSafely(
    {
      from: SMTP_FROM,
      to: toEmail,
      subject: `【${brandName}】你的本周匹配结果已送达`,
      text: [
        `【${brandName} 每周匹配】`,
        `匹配对象：${partnerEmail}`,
        `匹配度：${matchPercent}%`,
        `你的ROSE：${selfRose}`,
        `对方ROSE：${partnerRose}`,
        `致命契合点：${killerPoint}`,
        `派发时间：${formattedRunTime} (Asia/Shanghai)`
      ].join('\n')
    },
    'Failed to send match email'
  );
}
