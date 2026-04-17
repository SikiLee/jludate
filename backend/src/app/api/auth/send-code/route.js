import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { sendVerificationEmail } from 'lib/email';
import { resolvePreferredEmailTargetByCampusEmail } from 'lib/emailException';
import {
  createInactiveUserWithEncryptedEmail,
  findUserByEmail,
  updateEncryptedEmailForUser
} from 'lib/identityLink';
import { bizError, httpError, success } from 'lib/response';
import { isAllowedSchoolEmail, readJson } from 'lib/request';
import { getAllowedEmailDomains } from 'lib/siteConfig';
import { rateLimit } from 'lib/rateLimit';
import { logError } from 'lib/securityLog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function generateCode() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

function shouldExposeCodeForTests() {
  return process.env.EXPOSE_VERIFICATION_CODE_FOR_TESTS === 'true';
}

export async function POST(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const body = await readJson(request);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const rl = rateLimit(request, 'auth_send_code', { email, limit: 5, windowMs: 60_000 });
    if (!rl.allowed) {
      return bizError(429, `Too many requests. Please try again in ${rl.retryAfterSec}s`);
    }
    const allowedDomains = await getAllowedEmailDomains(surveyPool);

    if (!isAllowedSchoolEmail(email, allowedDomains)) {
      return bizError(400, `Only allowed email domains are accepted: ${allowedDomains.join(', ')}`);
    }

    const existingUser = await findUserByEmail(identityPool, email);

    const code = generateCode();

    if (existingUser) {
      if (existingUser.is_active) {
        return bizError(400, 'Email already registered');
      }

      await identityPool.query(
        'UPDATE unidate_app.users SET verification_code = $1 WHERE id = $2',
        [code, existingUser.id]
      );

      // Ensure existing pre-upgrade account also has encrypted email fields.
      await updateEncryptedEmailForUser(identityPool, existingUser.id, email);
    } else {
      await createInactiveUserWithEncryptedEmail(identityPool, email, code);
    }

    const preferredTarget = await resolvePreferredEmailTargetByCampusEmail(email);
    const deliveryEmail = preferredTarget?.delivery_email || email;
    const sent = await sendVerificationEmail(deliveryEmail, code);
    if (!sent) {
      return bizError(
        502,
        '验证码邮件发送失败，请稍后重试。若您自行部署站点，请检查服务器 SMTP 配置（SMTP_HOST、端口、账号密码）及发信服务商是否拦截。'
      );
    }
    if (shouldExposeCodeForTests()) {
      return success('Verification code sent successfully', {
        debug_verification_code: code,
        debug_delivery_email: deliveryEmail
      });
    }
    return success('Verification code sent successfully');
  } catch (error) {
    logError('POST /api/auth/send-code failed', error);
    return httpError(500, 'Internal Server Error');
  }
}
