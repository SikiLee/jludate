import { ensureServerBootstrap } from 'lib/bootstrap';
import { ensureSchema, identityPool, surveyPool } from 'lib/db';
import { sendVerificationEmail } from 'lib/email';
import {
  computeEmailHash,
  generateVerificationCode,
  isValidBackupEmail
} from 'lib/emailException';
import { bizError, httpError, success } from 'lib/response';
import { isAllowedSchoolEmail, readJson } from 'lib/request';
import { getAllowedEmailDomains } from 'lib/siteConfig';
import { rateLimit } from 'lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const body = await readJson(request);
    const schoolEmail = typeof body?.school_email === 'string' ? body.school_email.trim().toLowerCase() : '';
    const backupEmail = typeof body?.backup_email === 'string' ? body.backup_email.trim().toLowerCase() : '';
    const rl = rateLimit(request, 'email_exception_send_backup_code', {
      email: `${schoolEmail}|${backupEmail}`,
      limit: 5,
      windowMs: 60_000
    });
    if (!rl.allowed) {
      return bizError(429, `请求过于频繁，请 ${rl.retryAfterSec}s 后再试`);
    }

    const allowedDomains = await getAllowedEmailDomains(surveyPool);
    if (!isAllowedSchoolEmail(schoolEmail, allowedDomains)) {
      return bizError(400, `校园邮箱域名不合法，仅支持：${allowedDomains.join(', ')}`);
    }
    if (!isValidBackupEmail(backupEmail)) {
      return bizError(400, '备用邮箱格式不正确');
    }

    const code = generateVerificationCode();
    const schoolEmailHash = computeEmailHash(schoolEmail);
    const existing = await identityPool.query(
      `
      SELECT id
      FROM unidate_app.email_exception_applications
      WHERE school_email_hash = $1 AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [schoolEmailHash]
    );

    if (existing.rowCount > 0) {
      await identityPool.query(
        `
        UPDATE unidate_app.email_exception_applications
        SET school_email = $1,
            backup_email = $2,
            backup_email_verified = FALSE,
            backup_code = $3,
            backup_code_sent_at = NOW(),
            backup_code_verified_at = NULL,
            updated_at = NOW()
        WHERE id = $4
        `,
        [schoolEmail, backupEmail, code, existing.rows[0].id]
      );
    } else {
      await identityPool.query(
        `
        INSERT INTO unidate_app.email_exception_applications(
          school_email,
          school_email_hash,
          backup_email,
          backup_email_verified,
          backup_code,
          backup_code_sent_at
        )
        VALUES ($1, $2, $3, FALSE, $4, NOW())
        `,
        [schoolEmail, schoolEmailHash, backupEmail, code]
      );
    }

    const sent = await sendVerificationEmail(backupEmail, code);
    if (!sent) {
      return bizError(
        502,
        '备用邮箱验证码发送失败，请稍后重试。若您自行部署站点，请检查服务器 SMTP 配置（SMTP_HOST、端口、账号密码）及发信服务商是否拦截。'
      );
    }
    return success('备用邮箱验证码已发送');
  } catch (error) {
    console.error('POST /api/auth/email-exception/send-backup-code failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
